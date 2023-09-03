import { first, switchMap, tap, withLatestFrom } from "rxjs/operators";
import { Mock, SpyInstance } from "vitest";

import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";
import { createSUT, HeroHub } from "./testing/hub-connection.util";
import { HubConnection } from "./hub-connection";
import { ConnectionStatus } from "./hub-connection.model";

import * as signalr from "@microsoft/signalr";

describe("HubConnection - setData Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let mockConnBuilder: MockSignalRHubConnectionBuilder;
	let hubBackend: MockSignalRHubBackend;
	let hubStartSpy: SpyInstance<[], Promise<void>>;
	let hubStopSpy: SpyInstance<[], Promise<void>>;
	let hubBuilderWithUrlSpy: SpyInstance<[], MockSignalRHubConnectionBuilder>;

	beforeEach(() => {
		mockConnBuilder = new MockSignalRHubConnectionBuilder();
		(signalr.HubConnectionBuilder as unknown as Mock).mockImplementation(() => mockConnBuilder);
	});

	afterEach(() => {
		SUT.dispose();
	});


	describe("given a connected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			const connect$ = SUT.connect().toPromise();
			hubStartSpy = vi.spyOn(hubBackend.connection, "start");
			hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
			hubBuilderWithUrlSpy = vi.spyOn(mockConnBuilder, "withUrl");
			return connect$;
		});

		afterEach(() => {
			hubStartSpy.mockClear();
			hubStopSpy.mockClear();
		});


		describe("when data changes", () => {


			it("should reconnect with new data", () => {
				return SUT.connectionState$.pipe(
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
				).toPromise();
			});


		});


		describe.skip("when data has not changed", () => {
		// describe("when data has not changed", () => {

			const data = {
				hero: "rexxar",
				power: "1337"
			};

			beforeEach(() => {
				SUT.setData(() => ({ ...data }));
				return SUT.connectionState$.pipe(
					first(),
					switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
				).toPromise().then(() => {
					hubStartSpy.mockClear();
					hubStopSpy.mockClear();
				});
			});


			it("should not reconnect", () => {
				return SUT.connectionState$.pipe(
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
				).toPromise();
			});


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


			it("should not connect", () => {
				return SUT.connectionState$.pipe(
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
				).toPromise();
			});


		});


	});


});
