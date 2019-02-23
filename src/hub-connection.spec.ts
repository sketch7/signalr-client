import { HubConnection } from "./hub-connection";
import { Subscription } from "rxjs";
import { first, switchMap, tap } from "rxjs/operators";
import { ConnectionStatus } from "./hub-connection.model";
import { MockSignalRHubConnectionBuilder, MockSignalRHubBackend } from "./testing";

import * as signalr from "@aspnet/signalr";
jest.genMockFromModule("@aspnet/signalr");
jest.mock("@aspnet/signalr");

let nextUniqueId = 0;

const mockConnBuilder = new MockSignalRHubConnectionBuilder();
(signalr.HubConnectionBuilder as unknown as jest.Mock).mockImplementation(() => mockConnBuilder);

interface HeroHub {
	UpdateHero: string;
}

function createSUT() {
	return new HubConnection<HeroHub>({
		key: `hero-${nextUniqueId++}`,
		endpointUri: "/hero"
	});
}

describe("HubConnectionSpecs", () => {

	let SUT: HubConnection<HeroHub>;
	let hubBackend: MockSignalRHubBackend;

	describe("given a disconnected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
		});

		describe("when connect is invoked", () => {

			let conn$$ = Subscription.EMPTY;
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

			afterEach(() => {
				conn$$.unsubscribe();
			});

		});
	});

	describe("given a connected connection", () => {

		let conn$$ = Subscription.EMPTY;

		beforeEach(done => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.getBackend();
			conn$$ = SUT.connect().subscribe(done);
		});

		describe("when disconnect is invoked", () => {

			it("should have status as disconnected", done => {
				conn$$ = SUT.disconnect().pipe(
					tap(x => console.warn(">>>> disconnected", x, SUT.key)),
					tap(() => hubBackend.triggerOnclose()),
					tap(x => console.warn(">>>> triggerOnclose triggered", x)),
					switchMap(() => SUT.connectionState$.pipe(first()))
				).subscribe({
					next: state => expect(state.status).toBe(ConnectionStatus.disconnected),
					complete: done
				});
			});

		});

		afterEach(() => {
			conn$$.unsubscribe();
		});

	});

});

