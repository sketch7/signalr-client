import { HubConnection } from "./hub-connection";
import { Subscription, lastValueFrom, merge, first, switchMap, tap, skip, delay, withLatestFrom } from "rxjs";
import type { Mock, MockInstance } from "vitest";

import { HeroHub, createSUT } from "./testing/hub-connection.util";
import { ConnectionStatus } from "./hub-connection.model";
import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";

import * as signalr from "@microsoft/signalr";
function promiseDelayResolve(ms: number) {
	return new Promise(r => setTimeout(r, ms));
}
function promiseDelayReject(ms: number, reason?: unknown) {
	return new Promise((_, reject) => setTimeout(() => reject(reason), ms));
}

describe("HubConnection Specs", () => {

	let SUT: HubConnection<HeroHub>;
	let mockConnBuilder: MockSignalRHubConnectionBuilder;
	let hubBackend: MockSignalRHubBackend;
	let conn$$ = Subscription.EMPTY;
	// let hubStartSpy: jest.SpyInstance<Promise<void>>;
	let hubStartSpy: MockInstance<[], Promise<void>>;
	// let hubStopSpy: jest.SpyInstance<Promise<void>>;
	let hubStopSpy: MockInstance<[], Promise<void>>;

	beforeEach(() => {
		mockConnBuilder = new MockSignalRHubConnectionBuilder();
		(signalr.HubConnectionBuilder as unknown as Mock).mockImplementation(() => mockConnBuilder);
	});

	describe("Connection Specs", () => {

		describe("given a disconnected connection", () => {

			beforeEach(() => {
				SUT = createSUT();
				hubBackend = mockConnBuilder.getBackend();
				hubStartSpy = vi.spyOn(hubBackend.connection, "start");
				hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
			});

			afterEach(() => {
				// SUT.dispose(); // todo: find why this is failing tests
				conn$$.unsubscribe();
			});

			describe("when connect is invoked", () => {

				describe("and connected successfully", () => {

					it("should have status as connected", async () => {
						await lastValueFrom(SUT.connect());

						const state = await lastValueFrom(SUT.connectionState$.pipe(
							delay(20),
							first(),
						));

						expect(state.status).toBe(ConnectionStatus.connected);
					});

				});

				describe("and invoked again concurrently", () => {

					beforeEach(() => {
						hubBackend.connection.start = vi.fn().mockReturnValue(promiseDelayResolve(5));
						hubBackend.connection.stop = vi.fn().mockReturnValue(promiseDelayResolve(5));
					});

					it("should connect once", async () => {
						const c1$ = lastValueFrom(SUT.connect());
						const c2$ = lastValueFrom(SUT.connect());

						await Promise.all([c1$, c2$]);

						const state = await lastValueFrom(SUT.connectionState$.pipe(
							delay(20),
							first(),
						));

						expect(state.status).toBe(ConnectionStatus.connected);
						expect(hubBackend.connection.start).toHaveBeenCalledTimes(1);
					});

				});

				describe("and while connecting disconnect was invoked", () => {

					beforeEach(() => {
						hubBackend.connection.start = vi.fn().mockReturnValue(promiseDelayResolve(5));
						hubBackend.connection.stop = vi.fn().mockReturnValue(promiseDelayResolve(5));
					});

					describe("and connects successfully", () => {

						// connect -> WHILE CONNECTING -> disconnect
						it("should have status disconnected", () => new Promise<void>(done => {
							const connect$ = SUT.connect();
							const state$ = SUT.connectionState$.pipe(
								first(),
								switchMap(() => SUT.disconnect()),
								delay(2), // ensure start is in flight
								withLatestFrom(SUT.connectionState$, (_x, y) => y),
								tap(state => {
									expect(hubBackend.connection.start).toHaveBeenCalledTimes(1);
									expect(hubBackend.connection.stop).toHaveBeenCalledTimes(1);
									expect(state.status).toBe(ConnectionStatus.disconnected);
									done();
								})
							);
							conn$$ = merge(connect$, state$).subscribe();
						}));

						describe("and connects with different data", () => {

							// connect -> WHILE CONNECTING -> disconnect -> connect with different data
							it("should have status connected", () => new Promise<void>(done => {
								const connect$ = SUT.connect();
								const state$ = SUT.connectionState$.pipe(
									first(),
									switchMap(() => SUT.disconnect()),
									delay(2), // ensure start is in flight
									switchMap(() => SUT.connect(() => ({ second: "true" }))),
									withLatestFrom(SUT.connectionState$, (_x, y) => y),
									tap(state => {
										expect(hubBackend.connection.start).toHaveBeenCalledTimes(2);
										expect(hubBackend.connection.stop).toHaveBeenCalledTimes(1);
										expect(state.status).toBe(ConnectionStatus.connected);
										done();
									})
								);
								conn$$ = merge(connect$, state$).subscribe();
							}));

						});

					});

					describe("and connect fails", () => {

						beforeEach(() => {
							hubBackend.connection.start = vi.fn().mockReturnValue(promiseDelayReject(5));
						});

						it("should have status disconnected", () => new Promise<void>(done => {
							const connect$ = SUT.connect();
							const state$ = SUT.connectionState$.pipe(
								first(),
								tap(x => console.warn(">>>> [spec] disconnect", x)),
								delay(2), // wait first try
								switchMap(() => SUT.disconnect()),
								tap(x => console.warn(">>>> [spec] disconnected", x)),
								delay(50), // ensure there are no pending connects
								withLatestFrom(SUT.connectionState$, (_x, y) => y),
								tap(x => console.warn(">>>> [spec] after delay", x)),
								tap(state => {
									expect(state.status).toBe(ConnectionStatus.disconnected);
									expect(hubBackend.connection.start).toHaveBeenCalledTimes(1);
									done();
								})
							);
							conn$$ = merge(connect$, state$).subscribe();
						}));

					});

				});

				describe("and fails to connect", () => {

					beforeEach(() => {
						hubBackend.connection.start = vi.fn().mockRejectedValue(new Error("Error while connecting"));
					});

					it("should have status reconnecting", () => new Promise<void>(done => {
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
					}));

					it("should emit error when retry attempts limit reached", () => new Promise<void>(done => {
						// todo: try and use scheduler
						SUT.connect().subscribe({
							error: () => {
								expect(hubBackend.connection.start).toBeCalledTimes(4); // todo: should this be one extra then specified?
								done();
							},
						});

					}));

					describe("when disconnect is invoked", () => {

						beforeEach(() => {
							hubStartSpy = vi.spyOn(hubBackend.connection, "start");
							hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
						});

						it("should stop retrying", () => new Promise<void>(done => {
							const triggerDisconnect = SUT.connectionState$.pipe(
								skip(1),
								first(),
								switchMap(() => SUT.disconnect()),
								switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.disconnected))),
								delay(50), // ensure there are no pending connects
								tap(state => {
									expect(state.status).toBe(ConnectionStatus.disconnected);
									expect(hubStartSpy).toBeCalledTimes(1);
									// expect(hubStopSpy).not.toBeCalled();
									done();
								}),
							);
							conn$$ = merge(SUT.connect(), triggerDisconnect).subscribe();
						}));

					});

				});

			});

		});

		describe("given a connected connection", () => {

			beforeEach(() => {
				SUT = createSUT();
				hubBackend = mockConnBuilder.getBackend();
				return lastValueFrom(SUT.connect());
			});

			describe("when disconnect is invoked", () => {

				it("should have status as disconnected", () => {
					const test$ = SUT.disconnect().pipe(
						tap(() => hubBackend.disconnect()),
						withLatestFrom(SUT.connectionState$, (_x, y) => y),
						tap(state => expect(state.status).toBe(ConnectionStatus.disconnected)
						));
					return lastValueFrom(test$);
				});

			});

			describe("when disconnects", () => {

				beforeEach(() => {
					// todo: check if redundant
					hubStartSpy = vi.spyOn(hubBackend.connection, "start");
					hubStopSpy = vi.spyOn(hubBackend.connection, "stop");
				});

				it("should reconnect", () => {
					const reconnect$ = SUT.connectionState$.pipe(
						first(),
						tap(state => expect(state.status).toBe(ConnectionStatus.connected)),
						tap(() => hubBackend.disconnect(new Error("Disconnected by the server"))),
						switchMap(() => SUT.connectionState$.pipe(first(x => x.status === ConnectionStatus.connected))),
						tap(state => {
							expect(state.status).toBe(ConnectionStatus.connected);
							expect(hubStartSpy).toBeCalledTimes(1);
							expect(hubStopSpy).not.toBeCalled();
						}),
						first()
					);
					return lastValueFrom(reconnect$);
				});

			});

		});

	});

});
