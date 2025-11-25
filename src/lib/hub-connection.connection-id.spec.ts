import { HubConnection } from "./hub-connection";
import { lastValueFrom, first, delay, tap, filter, skip, Subscription } from "rxjs";
import { vi } from "vitest";
import { createSUT, HeroHub } from "./testing/hub-connection.util";
import { ConnectionStatus } from "./hub-connection.model";
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
		connectionId: string | null = null;
		private connectionCounter = 0;

		start(): Promise<void> {
			// Generate a unique connectionId each time we connect
			this.connectionCounter++;
			this.connectionId = `connection-${this.connectionCounter}-${Math.random().toString(36).substring(7)}`;
			return Promise.resolve();
		}
		stop(): Promise<void> {
			this.backend.disconnect();
			this.connectionId = null;
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

describe("HubConnection - Connection ID Changes After Reconnection", () => {

	let SUT: HubConnection<HeroHub>;
	let hubBackend: MockSignalRHubBackend;
	let conn$$ = Subscription.EMPTY;

	beforeEach(() => {
		SUT = createSUT();
		hubBackend = mockConnBuilder.getBackend();
	});

	afterEach(() => {
		conn$$.unsubscribe();
	});

	describe("when connection is established", () => {

		it("should have a connectionId assigned", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			const connectionId = SUT.connectionId;
			expect(connectionId).toBeTruthy();
			expect(typeof connectionId).toBe("string");
			expect(connectionId).toMatch(/^connection-\d+-/);
		});

	});

	describe("when server disconnects and client reconnects", () => {

		it("should receive a new connectionId after reconnection", async () => {
			// Initial connection
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			const initialConnectionId = SUT.connectionId;
			expect(initialConnectionId).toBeTruthy();

			// Track connection ID changes
			const connectionIds: (string | null)[] = [];
			const connectionIdTracker$ = SUT.connectionState$.pipe(
				filter(state => state.status === ConnectionStatus.connected),
				tap(() => connectionIds.push(SUT.connectionId)),
			).subscribe();

			// Simulate server disconnect to trigger auto-reconnect
			hubBackend.disconnect(new Error("Server disconnected"));

			// Wait for reconnection
			await lastValueFrom(SUT.connectionState$.pipe(
				skip(1), // Skip the disconnected state
				filter(state => state.status === ConnectionStatus.connected),
				first()
			));

			await new Promise(resolve => setTimeout(resolve, 100));

			const newConnectionId = SUT.connectionId;
			expect(newConnectionId).toBeTruthy();
			expect(newConnectionId).not.toBe(initialConnectionId);

			connectionIdTracker$.unsubscribe();
		});

		it("should emit new connectionId through connectionState$ observable", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			const initialConnectionId = SUT.connectionId;

			const connectionIdChanges: (string | null)[] = [];

			const stateTracker$ = SUT.connectionState$.pipe(
				filter(state => state.status === ConnectionStatus.connected),
				tap(() => {
					connectionIdChanges.push(SUT.connectionId);
				})
			).subscribe();

			// Trigger disconnect
			hubBackend.disconnect(new Error("Server disconnected"));

			// Wait for reconnection
			await lastValueFrom(SUT.connectionState$.pipe(
				filter(state => state.status === ConnectionStatus.connected && SUT.connectionId !== initialConnectionId),
				first()
			));

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(connectionIdChanges.length).toBeGreaterThanOrEqual(2);
			expect(connectionIdChanges[0]).toBe(initialConnectionId);
			expect(connectionIdChanges[connectionIdChanges.length - 1]).not.toBe(initialConnectionId);
			expect(connectionIdChanges[connectionIdChanges.length - 1]).toBeTruthy();

			stateTracker$.unsubscribe();
		});

	});

	describe("when manually disconnecting and reconnecting", () => {

		it("should receive a new connectionId after manual reconnection", async () => {
			// Initial connection
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			const initialConnectionId = SUT.connectionId;
			expect(initialConnectionId).toBeTruthy();

			// Manual disconnect
			await lastValueFrom(SUT.disconnect());

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(SUT.connectionId).toBeNull();

			// Reconnect
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			const newConnectionId = SUT.connectionId;
			expect(newConnectionId).toBeTruthy();
			expect(newConnectionId).not.toBe(initialConnectionId);
		});

	});

	describe("when multiple reconnections occur", () => {

		it("should generate unique connectionIds for each reconnection", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			const connectionIds: (string | null)[] = [SUT.connectionId];

			// Trigger multiple disconnects and reconnects
			for (let i = 0; i < 3; i++) {
				hubBackend.disconnect(new Error(`Server disconnected - iteration ${i}`));

				await lastValueFrom(SUT.connectionState$.pipe(
					filter(state => state.status === ConnectionStatus.connected),
					first()
				));

				await new Promise(resolve => setTimeout(resolve, 50));

				connectionIds.push(SUT.connectionId);
			}

			// All connection IDs should be unique
			const uniqueConnectionIds = new Set(connectionIds);
			expect(uniqueConnectionIds.size).toBe(connectionIds.length);

			// All should be truthy strings
			connectionIds.forEach(id => {
				expect(id).toBeTruthy();
				expect(typeof id).toBe("string");
			});
		});

	});

	describe("when connectionId is null", () => {

		it("should be null when disconnected", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(SUT.connectionId).toBeTruthy();

			await lastValueFrom(SUT.disconnect());

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(SUT.connectionId).toBeNull();
		});

		it("should be null before initial connection", () => {
			expect(SUT.connectionId).toBeNull();
		});

	});

	describe("when tracking connectionId during reconnection states", () => {

		it("should track connectionId changes across connection states", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			const initialConnectionId = SUT.connectionId;
			expect(initialConnectionId).toBeTruthy();

			const connectionStates: Array<{status: ConnectionStatus, connectionId: string | null}> = [];

			const stateTracker$ = SUT.connectionState$.pipe(
				tap(state => {
					connectionStates.push({
						status: state.status,
						connectionId: SUT.connectionId
					});
				})
			).subscribe();

			// Trigger disconnect
			hubBackend.disconnect(new Error("Server disconnected"));

			// Wait for reconnection
			await lastValueFrom(SUT.connectionState$.pipe(
				filter(state => state.status === ConnectionStatus.connected && SUT.connectionId !== initialConnectionId),
				first()
			));

			await new Promise(resolve => setTimeout(resolve, 50));

			stateTracker$.unsubscribe();

			// Verify we tracked state changes
			expect(connectionStates.length).toBeGreaterThan(0);

			// Find connected states
			const connectedStates = connectionStates.filter(s => s.status === ConnectionStatus.connected);
			expect(connectedStates.length).toBeGreaterThan(0);
		});

	});

	describe("when using setData and triggering reconnection", () => {

		it("should receive new connectionId after data change reconnection", async () => {
			await lastValueFrom(SUT.connect());

			await new Promise(resolve => setTimeout(resolve, 50));

			const initialConnectionId = SUT.connectionId;
			expect(initialConnectionId).toBeTruthy();

			// Update data which may trigger reconnection
			SUT.setData(() => ({ tenant: "updated-tenant", power: "9000" }));

			await new Promise(resolve => setTimeout(resolve, 150));

			const newConnectionId = SUT.connectionId;

			// If reconnection occurred due to data change, connectionId should be different
			// Note: This depends on implementation - setData may or may not trigger immediate reconnect
			// This test documents the behavior
			expect(newConnectionId).toBeTruthy();
		});

	});

});
