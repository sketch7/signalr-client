import { Mock, SpyInstance } from "vitest";

import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";
import { createSUT, HeroHub } from "./testing/hub-connection.util";
import { HubConnection } from "./hub-connection";

import * as signalr from "@microsoft/signalr";

// tslint:disable: no-consecutive-blank-lines
describe("HubConnection - dispose Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let mockConnBuilder: MockSignalRHubConnectionBuilder;
	let hubBackend: MockSignalRHubBackend;
	let hubStopSpy: SpyInstance<[], Promise<void>>;

	beforeEach(() => {
		mockConnBuilder = new MockSignalRHubConnectionBuilder();
		(signalr.HubConnectionBuilder as unknown as Mock).mockImplementation(() => mockConnBuilder);
	});

	describe("given a connected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
			return SUT.connect().toPromise();
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
