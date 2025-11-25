import { lastValueFrom } from "rxjs";
import { Mock, MockInstance, vi } from "vitest";

import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";
import { createSUT, HeroHub } from "./testing/hub-connection.util";
import { HubConnection } from "./hub-connection";

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

// tslint:disable: no-consecutive-blank-lines
describe("HubConnection - dispose Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let hubBackend: MockSignalRHubBackend;
	let hubStopSpy: MockInstance;

	beforeEach(() => {
		// Mock is set up in vi.mock factory above
	});

	describe("given a connected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
			return lastValueFrom(SUT.connect());
		});

		it("should close connection", () => {
			SUT.dispose();
			expect(hubStopSpy).toBeCalledTimes(1);
		});

	});

	describe("given a disconnected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
		});

		it("should dispose correctly", () => {
			const connStateComplete = vi.fn();
			SUT.connectionState$.subscribe({
				complete: connStateComplete
			});
			SUT.dispose();
			expect(hubStopSpy).not.toBeCalled();
			expect(connStateComplete).toBeCalledTimes(1);
		});

	});

});
