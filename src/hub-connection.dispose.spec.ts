import { Subscription } from "rxjs";

import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";
import { createSUT, HeroHub } from "./testing/hub-connection.util";
import { HubConnection } from "./hub-connection";

import * as signalr from "@microsoft/signalr";

// tslint:disable: no-consecutive-blank-lines
describe("HubConnection - dispose Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let mockConnBuilder: MockSignalRHubConnectionBuilder;
	let hubBackend: MockSignalRHubBackend;
	let conn$$ = Subscription.EMPTY;
	let hubStopSpy: jest.SpyInstance<Promise<void>>;

	beforeEach(() => {
		mockConnBuilder = new MockSignalRHubConnectionBuilder();
		(signalr.HubConnectionBuilder as unknown as jest.Mock).mockImplementation(() => mockConnBuilder);
	});

	afterEach(() => {
		conn$$.unsubscribe();
	});


	describe("given a connected connection", () => {

		beforeEach(done => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			conn$$ = SUT.connect().subscribe(done);
			hubStopSpy = jest.spyOn(hubBackend.connection, "stop");
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
			hubStopSpy = jest.spyOn(hubBackend.connection, "stop");
		});



		it("should dispose correctly", () => {
			const connStateComplete = jest.fn();
			SUT.connectionState$.subscribe({
				complete: connStateComplete
			});
			SUT.dispose();
			expect(hubStopSpy).not.toBeCalled();
			expect(connStateComplete).toBeCalledTimes(1);
		});



	});



});