import { Subscription } from "rxjs";
import { first, switchMap, tap, withLatestFrom } from "rxjs/operators";

import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";
import { createSUT, HeroHub } from "./testing/hub-connection.util";
import { HubConnection } from "./hub-connection";
import { ConnectionStatus } from "./hub-connection.model";

import * as signalr from "@aspnet/signalr";

describe("HubConnection - setData Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let mockConnBuilder: MockSignalRHubConnectionBuilder;
	let hubBackend: MockSignalRHubBackend;
	let conn$$ = Subscription.EMPTY;
	let hubStartSpy: jest.SpyInstance<Promise<void>>;
	let hubStopSpy: jest.SpyInstance<Promise<void>>;
	let hubBuilderWithUrlSpy: jest.SpyInstance<MockSignalRHubConnectionBuilder>;

	beforeEach(() => {
		mockConnBuilder = new MockSignalRHubConnectionBuilder();
		(signalr.HubConnectionBuilder as unknown as jest.Mock).mockImplementation(() => mockConnBuilder);
	});

	afterEach(() => {
		SUT.dispose();
		conn$$.unsubscribe();
	});


	describe("given a connected connection", () => {

		beforeEach(done => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			conn$$ = SUT.connect().subscribe(done);
			hubStartSpy = jest.spyOn(hubBackend.connection, "start");
			hubStopSpy = jest.spyOn(hubBackend.connection, "stop");
			hubBuilderWithUrlSpy = jest.spyOn(mockConnBuilder, "withUrl");
		});


		describe("when data changes", () => {



			it("should reconnect with new data", done => {
				conn$$ = SUT.connectionState$.pipe(
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
						done();
					}),
					first()
				).subscribe();
			});



		});



		xdescribe("when data has not changed", () => {

			const data = {
				hero: "rexxar",
				power: "1337"
			};

			beforeEach(done => {
				SUT.setData(() => ({ ...data }));
				SUT.connectionState$.pipe(
					first(),
					tap(x => console.info("[spec] PRE connectionState #1", x)),
					switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
					tap(x => console.info("[spec] PRE connectionState #2", x)),
				).subscribe({
					complete: () => {
						hubStartSpy.mockClear();
						hubStopSpy.mockClear();
						done();
					}
				});

			});



			it("should not reconnect", done => {
				conn$$ = SUT.connectionState$.pipe(
					first(),
					tap(state => expect(state.status).toBe(ConnectionStatus.connected)),
					tap(() => SUT.setData(() => ({ ...data }))),
					switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
					tap(state => {
						expect(hubStartSpy).not.toBeCalled();
						expect(hubStopSpy).not.toBeCalled();
						expect(state.status).toBe(ConnectionStatus.disconnected);
						done();
					}),
					first()
				).subscribe();
			});



		});



	});



	describe("given a disconnected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			hubStartSpy = jest.spyOn(hubBackend.connection, "start");
			hubStopSpy = jest.spyOn(hubBackend.connection, "stop");
			hubBuilderWithUrlSpy = jest.spyOn(mockConnBuilder, "withUrl");
		});


		describe("when data changes", () => {


			it("should not connect", done => {
				conn$$ = SUT.connectionState$.pipe(
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
				).subscribe({ complete: done });
			});



		});



	});




});