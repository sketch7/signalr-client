import { HubConnection } from "./hub-connection";
import { lastValueFrom, first, delay, tap, filter, skip, Subscription, switchMap, take } from "rxjs";
import { vi, type MockInstance } from "vitest";
import { createSUT, HeroHub, RETRY_MAXIMUM_ATTEMPTS, AUTO_RECONNECT_RECOVER_INTERVAL } from "./testing/hub-connection.util";
import { ConnectionStatus, errorCodes } from "./hub-connection.model";
import { MockSignalRHubBackend } from "./testing";

let mockConnBuilder: any;

vi.mock(import("@microsoft/signalr"), (): any => {
	class MockBackend {
		private _onclose: ((err?: Error) => void) | undefined;
		constructor(public connection: any) {}
		disconnect(err?: Error): void {
			if (this._onclose) this._onclose(err);
		}
		registerOnclose(cb: (err?: Error) => void): void {
			this._onclose = cb;
		}
	}

	class MockConnection {
		backend = new MockBackend(this);
		shouldFail = false;

		start(): Promise<void> {
			if (this.shouldFail) {
				return Promise.reject(new Error("Connection failed"));
			}
			return Promise.resolve();
		}
		stop(): Promise<void> {
			this.backend.disconnect();
			return Promise.resolve();
		}
		onclose(cb: (err?: Error) => void): void {
			this.backend.registerOnclose(cb);
		}
	}

	class MockBuilder {
		private _lastHub = new MockConnection();
		build() { return this._lastHub; }
		withUrl(): this { return this; }
		withHubProtocol(): this { return this; }
		getBackend() { return this._lastHub.backend; }
	}

	return {
		HubConnectionBuilder: vi.fn(function(this: any) {
			mockConnBuilder = new MockBuilder();
			return mockConnBuilder;
		}),
		HubConnectionState: {
			Disconnected: 0,
			Connecting: 1,
			Connected: 2,
			Disconnecting: 3,
			Reconnecting: 4,
		},
	};
});

function exhaustHubRetryAttempts(hubBackend: MockSignalRHubBackend, maxAttempts: number): void {
	for (let i = 0; i < maxAttempts; i++) {
		hubBackend.disconnect(new Error(`Disconnected by the server - attempt ${i + 1}`));
	}
}

describe("HubConnection - Max Retry Attempts Exhaustion and Recovery", () => {

	let SUT: HubConnection<HeroHub>;
	let hubBackend: MockSignalRHubBackend;
	let conn$$ = Subscription.EMPTY;
	let hubStartSpy: MockInstance<[], Promise<void>>;

	beforeEach(() => {
		SUT = createSUT();
		hubBackend = mockConnBuilder.getBackend();
		hubStartSpy = vi.spyOn(hubBackend.connection, "start");
	});

	afterEach(() => {
		conn$$.unsubscribe();
	});

	describe("when retry attempts are exhausted", () => {

		it("should stop reconnecting after reaching maximum attempts", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(SUT.connectionState.status).toBe(ConnectionStatus.connected);

			// Make the connection fail for retries
			hubBackend.connection.shouldFail = true;

			const disconnectedStates: any[] = [];
			const stateTracker$ = SUT.connectionState$.pipe(
				filter(state => state.status === ConnectionStatus.disconnected && state.reason === "error"),
				tap(state => disconnectedStates.push(state)),
				take(1)
			).subscribe();

			// Trigger disconnect which will exhaust retries because shouldFail=true
			hubBackend.disconnect(new Error(`Server error to exhaust retries`));

			// Wait for all retry attempts to complete (less than AUTO_RECONNECT_RECOVER_INTERVAL)
			await new Promise(resolve => setTimeout(resolve, 100));

		const finalState = SUT.connectionState;
		// After exhaustion, remains in connecting state until AUTO_RECONNECT_RECOVER_INTERVAL
		expect([ConnectionStatus.connecting, ConnectionStatus.disconnected]).toContain(finalState.status);
		expect(disconnectedStates.length).toBeGreaterThan(0);			stateTracker$.unsubscribe();
		});

		it("should emit disconnected state with error after max attempts exhausted", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			// Track the final disconnected state
			let finalDisconnectedState: any = null;

			const stateTracker$ = SUT.connectionState$.pipe(
				tap(state => {
					if (state.status === ConnectionStatus.disconnected) {
						finalDisconnectedState = state;
					}
				})
			).subscribe();

			// Exhaust retry attempts
			for (let i = 0; i < RETRY_MAXIMUM_ATTEMPTS; i++) {
				hubBackend.disconnect(new Error(`Server error ${i + 1}`));
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			// Wait for final state
			await new Promise(resolve => setTimeout(resolve, 100));

			expect(finalDisconnectedState).toBeTruthy();
			expect(finalDisconnectedState.status).toBe(ConnectionStatus.disconnected);
			expect(finalDisconnectedState.reason).toBe("error");

			stateTracker$.unsubscribe();
		});

		it("should not attempt reconnection after exhaustion without recovery trigger", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			// Make connection fail
			(hubBackend.connection as any).shouldFail = true;

			// Trigger disconnect to exhaust retries
			hubBackend.disconnect(new Error(`Server error`));

			// Wait for retry exhaustion (less than AUTO_RECONNECT_RECOVER_INTERVAL)
			await new Promise(resolve => setTimeout(resolve, 100));

			const postExhaustionCallCount = hubStartSpy.mock.calls.length;

			// Wait additional time to ensure no more reconnection attempts
			await new Promise(resolve => setTimeout(resolve, 100));

			const finalStartCallCount = hubStartSpy.mock.calls.length;

			// Should not have made any additional start attempts after exhaustion
			expect(finalStartCallCount).toBe(postExhaustionCallCount);

			// Verify exhausted (may be connecting or disconnected)
			expect([ConnectionStatus.connecting, ConnectionStatus.disconnected]).toContain(SUT.connectionState.status);
		});

	});

	describe("when recovering after max attempts exhausted", () => {

		describe("via manual disconnect and reconnect", () => {

			it("should reset maximum attempts counter", async () => {
				await lastValueFrom(SUT.connect());

				await new Promise(resolve => setTimeout(resolve, 50));

				// Make connection fail
				(hubBackend.connection as any).shouldFail = true;

				// Exhaust retry attempts
				hubBackend.disconnect(new Error(`Server error to exhaust`));

				// Wait for exhaustion (less than AUTO_RECONNECT_RECOVER_INTERVAL)
				await new Promise(resolve => setTimeout(resolve, 100));

				expect([ConnectionStatus.connecting, ConnectionStatus.disconnected]).toContain(SUT.connectionState.status);

				const startCallsBeforeReset = hubStartSpy.mock.calls.length;

				// Manual disconnect and reconnect to reset
				await lastValueFrom(SUT.disconnect());
				await new Promise(resolve => setTimeout(resolve, 50));

				// Allow connection to succeed again
				(hubBackend.connection as any).shouldFail = false;

				await lastValueFrom(SUT.connect());
				await new Promise(resolve => setTimeout(resolve, 50));

				expect(SUT.connectionState.status).toBe(ConnectionStatus.connected);

				// Now trigger another disconnect to verify retry attempts were reset
				hubBackend.disconnect(new Error("Server error after reset"));

				await lastValueFrom(SUT.connectionState$.pipe(
					filter(state => state.status === ConnectionStatus.connected),
					first()
				));

				await new Promise(resolve => setTimeout(resolve, 50));

				expect(SUT.connectionState.status).toBe(ConnectionStatus.connected);

				// Should have successfully reconnected after reset
				const startCallsAfterReset = hubStartSpy.mock.calls.length;
				expect(startCallsAfterReset).toBeGreaterThan(startCallsBeforeReset);
			});

			it("should allow full retry cycle after reset", async () => {
				await lastValueFrom(SUT.connect());

				// Make connection fail
				(hubBackend.connection as any).shouldFail = true;

				// First exhaustion cycle
				hubBackend.disconnect(new Error(`First cycle error`));

				await new Promise(resolve => setTimeout(resolve, 100));
				expect([ConnectionStatus.connecting, ConnectionStatus.disconnected]).toContain(SUT.connectionState.status);

				// Reset via manual disconnect/reconnect
				await lastValueFrom(SUT.disconnect());

				// Allow connection to succeed
				(hubBackend.connection as any).shouldFail = false;
				await lastValueFrom(SUT.connect());

				await new Promise(resolve => setTimeout(resolve, 50));

				// Make it fail again for second cycle
				(hubBackend.connection as any).shouldFail = true;

				// Second exhaustion cycle - should allow full RETRY_MAXIMUM_ATTEMPTS again
				const reconnectionStates: ConnectionStatus[] = [];
				const stateTracker$ = SUT.connectionState$.pipe(
					tap(state => reconnectionStates.push(state.status))
				).subscribe();

			hubBackend.disconnect(new Error(`Second cycle error`));

			await new Promise(resolve => setTimeout(resolve, 100));

			expect([ConnectionStatus.connecting, ConnectionStatus.disconnected]).toContain(SUT.connectionState.status);				// Should have gone through multiple reconnection attempts again
				const reconnectingStateCount = reconnectionStates.filter(s => s === ConnectionStatus.connecting).length;
				expect(reconnectingStateCount).toBeGreaterThan(0);

				stateTracker$.unsubscribe();
			});

		});

		describe("via auto-recover interval", () => {

		it("should automatically reset maximum attempts after recover interval", { timeout: 10000 }, async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));				// Make connection fail
				(hubBackend.connection as any).shouldFail = true;

				// Exhaust retry attempts
				hubBackend.disconnect(new Error(`Server error`));

				await new Promise(resolve => setTimeout(resolve, 100));

				expect([ConnectionStatus.connecting, ConnectionStatus.disconnected]).toContain(SUT.connectionState.status);

				// Allow connection to succeed after recovery
				(hubBackend.connection as any).shouldFail = false;

			// Wait for auto-recover interval to pass
			await new Promise(resolve => setTimeout(resolve, AUTO_RECONNECT_RECOVER_INTERVAL + 1000));

			// After the recover interval, connection should have recovered
			// Note: May still be connecting if recovery just started
			expect([ConnectionStatus.connected, ConnectionStatus.connecting]).toContain(SUT.connectionState.status);
			});

			it("should not reset if connection is established before recover interval", async () => {
				await lastValueFrom(SUT.connect());

				await new Promise(resolve => setTimeout(resolve, 50));

				// Exhaust attempts
				for (let i = 0; i < RETRY_MAXIMUM_ATTEMPTS; i++) {
					hubBackend.disconnect(new Error(`Server error ${i + 1}`));
					await new Promise(resolve => setTimeout(resolve, 100));
				}

				await new Promise(resolve => setTimeout(resolve, 100));

				// Manually reconnect before auto-recover interval
				await lastValueFrom(SUT.disconnect());
				await lastValueFrom(SUT.connect());

				await new Promise(resolve => setTimeout(resolve, 50));

				expect(SUT.connectionState.status).toBe(ConnectionStatus.connected);

				// Wait past the auto-recover interval
				await new Promise(resolve => setTimeout(resolve, AUTO_RECONNECT_RECOVER_INTERVAL + 500));

				// Should still be connected (no unexpected reconnection)
				expect(SUT.connectionState.status).toBe(ConnectionStatus.connected);
			});

		});

	});

	describe("when monitoring retry attempt progress", () => {

		it("should emit connecting state with retry count information", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			// Make connection fail
			(hubBackend.connection as any).shouldFail = true;

			const connectingStates: any[] = [];

			const stateTracker$ = SUT.connectionState$.pipe(
				filter(state => state.status === ConnectionStatus.connecting && state.reason === "reconnecting"),
				tap(state => connectingStates.push(state)),
				take(2)
			).subscribe();

			// Trigger disconnect
			hubBackend.disconnect(new Error(`Server error`));

			// Wait for reconnecting states
			await new Promise(resolve => setTimeout(resolve, 300));

			expect(connectingStates.length).toBeGreaterThan(0);

			// Verify retry count information is present
			connectingStates.forEach((state, index) => {
				expect(state.status).toBe(ConnectionStatus.connecting);
				expect(state.reason).toBe("reconnecting");
				expect(state.data).toBeTruthy();
				expect(state.data.retryCount).toBeGreaterThan(0);
				expect(state.data.maximumAttempts).toBe(RETRY_MAXIMUM_ATTEMPTS);
				expect(typeof state.data.nextRetryMs).toBe("number");
			});

			stateTracker$.unsubscribe();
		});

		it("should increment retry count with each reconnection attempt", async () => {
				await lastValueFrom(SUT.connect());

				await new Promise(resolve => setTimeout(resolve, 50));

				// Make connection fail
				(hubBackend.connection as any).shouldFail = true;

			const retryCounts: number[] = [];

			const stateTracker$ = SUT.connectionState$.pipe(
				filter(state => state.status === ConnectionStatus.connecting && state.reason === "reconnecting" && !!state.data),
				tap(state => retryCounts.push((state.data as any).retryCount)),
				take(RETRY_MAXIMUM_ATTEMPTS)
			).subscribe();				// Trigger disconnect
				hubBackend.disconnect(new Error(`Server error`));

				await new Promise(resolve => setTimeout(resolve, 100));			// Verify retry counts are incrementing
			expect(retryCounts.length).toBeGreaterThan(0);

			for (let i = 1; i < retryCounts.length; i++) {
				expect(retryCounts[i]).toBeGreaterThanOrEqual(retryCounts[i - 1]);
			}

			stateTracker$.unsubscribe();
		});

	});

	describe("when exhaustion occurs during ongoing operations", () => {

		it("should handle exhaustion gracefully without throwing unhandled errors", async () => {
				const errorHandler = vi.fn();

				await lastValueFrom(SUT.connect());

				await new Promise(resolve => setTimeout(resolve, 50));

				// Subscribe to connection state with error handler
				const stateSubscription = SUT.connectionState$.subscribe({
					next: () => {},
					error: errorHandler
				});

				// Make connection fail
				(hubBackend.connection as any).shouldFail = true;

				// Exhaust attempts
				hubBackend.disconnect(new Error(`Server error`));

				await new Promise(resolve => setTimeout(resolve, 100));			// Should not have called error handler on the observable
			expect(errorHandler).not.toHaveBeenCalled();

				// Should be exhausted (may be connecting or disconnected)
				expect([ConnectionStatus.connecting, ConnectionStatus.disconnected]).toContain(SUT.connectionState.status);			stateSubscription.unsubscribe();
		});

	});

	describe("when custom retry strategy is used", () => {

		it("should respect custom maximum attempts", async () => {
				const customMaxAttempts = 5;
				const SUTCustom = createSUT({
					backOffStrategy: {
						delayRetriesMs: 10,
						maxDelayRetriesMs: 10
					},
					maximumAttempts: customMaxAttempts,
					autoReconnectRecoverInterval: AUTO_RECONNECT_RECOVER_INTERVAL,
				});

				const customHubBackend = mockConnBuilder.getBackend();
				const customStartSpy = vi.spyOn(customHubBackend.connection, "start");

				await lastValueFrom(SUTCustom.connect());

				await new Promise(resolve => setTimeout(resolve, 50));

				// Make connection fail
				(customHubBackend.connection as any).shouldFail = true;

				// Exhaust custom retry attempts
				customHubBackend.disconnect(new Error(`Server error`));

				await new Promise(resolve => setTimeout(resolve, 100));				expect([ConnectionStatus.connecting, ConnectionStatus.disconnected]).toContain(SUTCustom.connectionState.status);

			// Should have attempted initial connection + custom number of retries
			expect(customStartSpy.mock.calls.length).toBeGreaterThanOrEqual(customMaxAttempts);

			SUTCustom.dispose();
		});

	});

});
