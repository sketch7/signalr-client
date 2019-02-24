import { HubConnection } from "./hub-connection";
import { Subscription, merge } from "rxjs";
import { first, switchMap, tap, skip, delay } from "rxjs/operators";
// import { TestScheduler } from "rxjs/testing";
import { ConnectionStatus } from "./hub-connection.model";
import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";

import * as signalr from "@aspnet/signalr";
jest.genMockFromModule("@aspnet/signalr");
jest.mock("@aspnet/signalr");

let nextUniqueId = 0;

interface HeroHub {
	UpdateHero: string;
}

function createSUT() {
	return new HubConnection<HeroHub>({
		key: `hero-${nextUniqueId++}`,
		endpointUri: "/hero",
		defaultData: () => ({ tenant: "kowalski", power: "2000" }),
		options: {
			retry: {
				maximumAttempts: 3,
				backOffStrategy: {
					delayRetriesMs: 10,
					maxDelayRetriesMs: 10
				}
			},
		}
	});
}

describe("HubConnection Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let mockConnBuilder: MockSignalRHubConnectionBuilder;
	let hubBackend: MockSignalRHubBackend;
	let conn$$ = Subscription.EMPTY;

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
							switchMap(() => SUT.connectionState$.pipe(first()))
						).subscribe({
							next: state => expect(state.status).toBe(ConnectionStatus.connected),
							complete: done
						});
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
							hubBackend.connection.stop = jest.fn();
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
									expect(hubBackend.connection.start).toBeCalledTimes(1);
									expect(hubBackend.connection.stop).not.toBeCalled();
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
						switchMap(() => SUT.connectionState$.pipe(first()))
					).subscribe({
						next: state => expect(state.status).toBe(ConnectionStatus.disconnected),
						complete: done
					});
				});

			});



			describe("when disconnects", () => {

				let hubStartSpy: jest.SpyInstance<Promise<void>>;
				let hubStopSpy: jest.SpyInstance<Promise<void>>;

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

	describe("setData Specs", () => {


		describe("given a connected connection", () => {

			let hubStartSpy: jest.SpyInstance<Promise<void>>;
			let hubStopSpy: jest.SpyInstance<Promise<void>>;
			let hubBuilderWithUrlSpy: jest.SpyInstance<MockSignalRHubConnectionBuilder>;

			beforeEach(done => {
				SUT = createSUT();
				hubBackend = mockConnBuilder.getBackend();
				conn$$ = SUT.connect().subscribe(done);
				hubStartSpy = jest.spyOn(hubBackend.connection, "start");
				hubBuilderWithUrlSpy = jest.spyOn(mockConnBuilder, "withUrl");
				hubStopSpy = jest.spyOn(hubBackend.connection, "stop");
			});


			describe("when data changes", () => {



				it("should reconnect with new data", done => {
					conn$$ = SUT.connectionState$.pipe(
						first(),
						tap(x => console.info("[spec] connectionState #1", x)),
						tap(state => expect(state.status).toBe(ConnectionStatus.connected)),
						tap(() => SUT.setData(() => ({
							hero: "rexxar",
							power: "1337"
						}))),
						// tap(x => console.info("[spec] disconnect #2", x)),
						switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
						tap(state => {
							console.info("[spec] test finished #3", state);
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



		});



	});


});