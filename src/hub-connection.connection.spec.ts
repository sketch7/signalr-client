import { HubConnection } from "./hub-connection";
import { Subscription, merge } from "rxjs";
import { first, switchMap, tap, skip, delay, withLatestFrom } from "rxjs/operators";

import { HeroHub, createSUT } from "./testing/hub-connection.util";
import { ConnectionStatus } from "./hub-connection.model";
import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";

import * as signalr from "@aspnet/signalr";
function delayPromise(ms: number) { return new Promise(r => setTimeout(r, ms)); }

describe("HubConnection Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let mockConnBuilder: MockSignalRHubConnectionBuilder;
	let hubBackend: MockSignalRHubBackend;
	let conn$$ = Subscription.EMPTY;
	let hubStartSpy: jest.SpyInstance<Promise<void>>;
	let hubStopSpy: jest.SpyInstance<Promise<void>>;

	beforeEach(() => {
		mockConnBuilder = new MockSignalRHubConnectionBuilder();
		(signalr.HubConnectionBuilder as unknown as jest.Mock).mockImplementation(() => mockConnBuilder);
	});

	describe("Connection Specs", () => {


		describe("given a disconnected connection", () => {

			beforeEach(() => {
				SUT = createSUT();
				hubBackend = mockConnBuilder.getBackend();
			});

			afterEach(() => {
				conn$$.unsubscribe();
			});

			describe("when connect is invoked", () => {

				describe("and connected successfully", () => {

					it("should have status as connected", done => {
						conn$$ = SUT.connect().pipe(
							withLatestFrom(SUT.connectionState$, (_x, y) => y),
						).subscribe({
							next: state => expect(state.status).toBe(ConnectionStatus.connected),
							complete: done
						});
					});



				});



				describe("and while connecting disconnect was invoked", () => {

					beforeEach(() => {
						hubBackend.connection.start = jest.fn().mockReturnValue(delayPromise(5));
					});

					// and fails
					// should

					it("should have status disconnected", done => {
						console.warn(">>>> START");

						const connect$ = SUT.connect();
						const state$ = SUT.connectionState$.pipe(
							first(),
							tap(x => console.warn(">>>> [spec] disconnect", x)),
							switchMap(() => SUT.disconnect()),
							tap(x => console.warn(">>>> [spec] disconnected", x)),
							delay(2),
							withLatestFrom(SUT.connectionState$, (_x, y) => y),
							tap(x => console.warn(">>>> [spec] after delay", x)),
							tap(state => {
								expect(hubBackend.connection.start).toHaveBeenCalledTimes(1);
								expect(state.status).toBe(ConnectionStatus.disconnected);
								done();
							})
						);
						conn$$ = merge(connect$, state$).subscribe();
					});



				});


				describe("and fails to connect", () => {

					beforeEach(() => {
						hubBackend.connection.start = jest.fn().mockRejectedValue(new Error("Error while connecting"));
					});

					it("should have status reconnecting", done => {
						const connect$ = SUT.connect();
						const state$ = SUT.connectionState$.pipe(
							skip(1),
							first(),
							tap(state => {
								expect(state.status).toBe(ConnectionStatus.connecting);
								expect(state.reason).toBe("reconnecting");
								done();
							})
						);
						conn$$ = merge(connect$, state$).subscribe();
					});

					it("should emit error when retry attempts limit reached", done => {
						// todo: try and use scheduler
						SUT.connect().subscribe({
							error: () => {
								expect(hubBackend.connection.start).toBeCalledTimes(4); // todo: should this be one extra then specified?
								done();
							},
						});

					});



					describe("when disconnect is invoked", () => {

						beforeEach(() => {
							hubStartSpy = jest.spyOn(hubBackend.connection, "start");
							hubStopSpy = jest.spyOn(hubBackend.connection, "stop");
						});

						it("should stop retrying", done => {

							const triggerDisconnect = SUT.connectionState$.pipe(
								skip(1),
								first(),
								switchMap(() => SUT.disconnect()),
								switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.disconnected))),
								delay(50), // ensure there are no pending connects
								tap(state => {
									expect(state.status).toBe(ConnectionStatus.disconnected);
									expect(hubStartSpy).toBeCalledTimes(1);
									expect(hubStopSpy).not.toBeCalled();
									done();
								}),
							);
							conn$$ = merge(SUT.connect(), triggerDisconnect).subscribe();
						});

					});



				});



			});

		});



		describe("given a connected connection", () => {

			beforeEach(done => {
				SUT = createSUT();
				hubBackend = mockConnBuilder.getBackend();
				conn$$ = SUT.connect().subscribe(done);
			});

			describe("when disconnect is invoked", () => {

				it("should have status as disconnected", done => {
					conn$$ = SUT.disconnect().pipe(
						tap(() => hubBackend.disconnect()),
						withLatestFrom(SUT.connectionState$, (_x, y) => y),
					).subscribe({
						next: state => expect(state.status).toBe(ConnectionStatus.disconnected),
						complete: done
					});
				});

			});



			describe("when disconnects", () => {

				beforeEach(() => {
					hubStartSpy = jest.spyOn(hubBackend.connection, "start");
					hubStopSpy = jest.spyOn(hubBackend.connection, "stop");
				});

				it("should reconnect", done => {

					const reconnect$ = SUT.connectionState$.pipe(
						first(),
						tap(state => expect(state.status).toBe(ConnectionStatus.connected)),
						tap(() => hubBackend.disconnect(new Error("Disconnected by the server"))),
						switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
						tap(state => {
							expect(state.status).toBe(ConnectionStatus.connected);
							expect(hubStartSpy).toBeCalledTimes(1);
							expect(hubStopSpy).not.toBeCalled();
							done();
						}),
						first()
					);
					conn$$ = reconnect$.subscribe();
				});

			});



		});



	});




});