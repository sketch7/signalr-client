import { HubConnection } from "./hub-connection";
import { Subscription } from "rxjs";
import { first, switchMap, tap } from "rxjs/operators";
import { ConnectionStatus } from "./hub-connection.model";

import * as signalr from "@aspnet/signalr";
jest.genMockFromModule("@aspnet/signalr");
jest.mock("@aspnet/signalr");

class MockSignalRHubConnectionBuilder {

	private _hub: MockSignalRHubConnection | undefined;

	build(): MockSignalRHubConnection {
		console.warn(">> [mockConnBuilder] build");
		const hub = new MockSignalRHubConnection();
		this._hub = hub;
		return hub;
	}

	withUrl(): this {
		return this;
	}

	// todo: perhaps find something nicer
	hijackConnection(): MockSignalRHubConnection {
		if (!this._hub) {
			throw Error("No connection to hijack!");
		}
		const hub = this._hub;
		this._hub = undefined;
		return hub;
	}

}

class MockSignalRHubConnection {

	private _onclose: ((err?: Error) => void) | undefined;

	start(): Promise<void> {
		console.log(">> [mockConn] start");
		return Promise.resolve();
	}

	stop(): Promise<void> {
		console.log(">> [mockConn] stop");
		return Promise.resolve();
	}

	onclose(_cb: (err?: Error) => void): void {
		console.log(">> [mockConn] onclose");
		this._onclose = _cb; // todo: handle multi
	}

	// todo: split into class
	triggerOnclose(err?: Error | undefined) {
		if (this._onclose) {
			this._onclose(err);
		}
	}

}

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
	let hubBackend: MockSignalRHubConnection;

	describe("given a disconnected connection", () => {

		beforeEach(() => {
			SUT = createSUT();
			hubBackend = mockConnBuilder.hijackConnection();
		});

		describe("and connect is invoked", () => {

			let conn$$ = Subscription.EMPTY;
			describe("when connected successfully", () => {

				it("should be marked as connected", done => {
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
			hubBackend = mockConnBuilder.hijackConnection();
			conn$$ = SUT.connect().subscribe(done);
		});

		describe("and disconnect is invoked", () => {

			it("should be marked as disconnected", done => {
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

			afterEach(() => {
				conn$$.unsubscribe();
			});

		});

	});

});

