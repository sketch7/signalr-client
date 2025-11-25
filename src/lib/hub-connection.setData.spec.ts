import { lastValueFrom, first, switchMap, tap, withLatestFrom  } from "rxjs";
import { vi, Mock, MockInstance } from "vitest";

import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";
import { createSUT, HeroHub } from "./testing/hub-connection.util";
import { HubConnection } from "./hub-connection";
import { ConnectionStatus } from "./hub-connection.model";

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
		start(): Promise<void> { return Promise.resolve(); }
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

describe("HubConnection - setData Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let hubBackend: MockSignalRHubBackend;
	let hubStartSpy: MockInstance<[], Promise<void>>;
	let hubStopSpy: MockInstance<[], Promise<void>>;
	let hubBuilderWithUrlSpy: MockInstance<[], MockSignalRHubConnectionBuilder>;

	beforeEach(() => {
		// Mock is set up in vi.mock factory above
	});

	afterEach(() => {
		SUT.dispose();
	});

	describe("given a connected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			const connect$ = lastValueFrom(SUT.connect());
			hubStartSpy = vi.spyOn(hubBackend.connection, "start");
			hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
			hubBuilderWithUrlSpy = vi.spyOn(mockConnBuilder, "withUrl");
			return connect$;
		});

	afterEach(() => {
		hubStartSpy?.mockClear();
		hubStopSpy?.mockClear();
	});
		describe("when data changes", () => {

			it("should reconnect with new data", () => lastValueFrom(SUT.connectionState$.pipe(
				first(),
				tap(state => expect(state.status).toBe(ConnectionStatus.connected)),
				tap(() => SUT.setData(() => ({
					hero: "rexxar",
					power: "1337"
				}))),
				switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
				tap(state => {
					expect(hubStartSpy).toBeCalledTimes(1);
					expect(hubStopSpy).toBeCalledTimes(1);
					expect(hubBuilderWithUrlSpy).toHaveBeenLastCalledWith("/hero?tenant=kowalski&power=1337&hero=rexxar", expect.any(Object));
					expect(state.status).toBe(ConnectionStatus.connected);
				}),
				first()
			)));

		});

		describe.skip("when data has not changed", () => {
		// describe("when data has not changed", () => {

			const data = {
				hero: "rexxar",
				power: "1337"
			};

			beforeEach(() => {
				SUT.setData(() => ({ ...data }));
				return lastValueFrom(SUT.connectionState$.pipe(
					first(),
					switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
				)).then(() => {
					hubStartSpy.mockClear();
					hubStopSpy.mockClear();
				});
			});

			it("should not reconnect", () => lastValueFrom(SUT.connectionState$.pipe(
				first(),
				tap(state => expect(state.status).toBe(ConnectionStatus.connected)),
				tap(() => SUT.setData(() => ({ ...data }))),
				switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
				tap(state => {
					expect(hubStartSpy).not.toBeCalled();
					expect(hubStopSpy).not.toBeCalled();
					expect(state.status).toBe(ConnectionStatus.disconnected);
				}),
				first()
			)));

		});

	});

	describe("given a disconnected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			hubStartSpy = vi.spyOn(hubBackend.connection, "start");
			hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
			hubBuilderWithUrlSpy = vi.spyOn(mockConnBuilder, "withUrl");
		});

		describe("when data changes", () => {

			it("should not connect", () => lastValueFrom(SUT.connectionState$.pipe(
				first(),
				tap(() => SUT.setData(() => ({
					hero: "rexxar",
					power: "1337"
				}))),
				withLatestFrom(SUT.connectionState$, (_x, y) => y),
				tap(state => {
					expect(hubStartSpy).not.toBeCalled();
					expect(hubStopSpy).not.toBeCalled();
					expect(state.status).toBe(ConnectionStatus.disconnected);
				}),
			)));

		});

	});

});
