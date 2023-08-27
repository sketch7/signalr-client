export class MockSignalRHubBackend {

	private _onclose: ((err?: Error) => void) | undefined;

	constructor(
		public connection: MockSignalRHubConnection
	) {
	}

	disconnect(err?: Error | undefined): void {
		console.warn("[backend] trigger disconnect", err ? err.message : undefined);
		if (this._onclose) {
			this._onclose(err);
		}
	}

	registerOnclose(cb: (err?: Error) => void): void {
		this._onclose = cb; // todo: handle multi
	}

}

export class MockSignalRHubConnectionBuilder {

	private _lastHub: MockSignalRHubConnection | undefined;

	build(): MockSignalRHubConnection {
		// console.info(">> [connectionBuilder] build");
		// todo: find way to validate whether its the same hub key so it wont get misused
		const hub = this._lastHub || new MockSignalRHubConnection();
		this._lastHub = hub;
		return hub;
	}

	withUrl(): this {
		return this;
	}

	getBackend(): MockSignalRHubBackend {
		if (!this._lastHub) {
			throw Error("No connection!");
		}
		const hub = this._lastHub;
		return hub.backend;
	}

}

export class MockSignalRHubConnection {

	backend = new MockSignalRHubBackend(this);

	start(): Promise<void> {
		// console.log(">> [mock conn] start");
		// return new Promise(resolve => setTimeout(resolve, 100));
		return Promise.resolve();
	}

	stop(): Promise<void> {
		// console.log(">> [mock conn] stop");
		this.backend.disconnect(); // todo: should we delay this so its more realistic?
		return Promise.resolve();
	}

	onclose(cb: (err?: Error) => void): void {
		// console.log(">> [mock conn] onclose");
		this.backend.registerOnclose(cb);
	}

	// stream<T = any>(methodName: string, ...args: any[]): signalr.IStreamResult<T> {
	// 	throw new Error("Method not implemented.");
	// }
	// send(methodName: string, ...args: any[]): Promise<void> {
	// 	throw new Error("Method not implemented.");
	// }
	// invoke<T = any>(methodName: string, ...args: any[]): Promise<T> {
	// 	throw new Error("Method not implemented.");
	// }
	// on(methodName: string, newMethod: (...args: any[]) => void): void {
	// 	throw new Error("Method not implemented.");
	// }
	// off(methodName: string): void;
	// off(methodName: string, method: (...args: any[]) => void): void;
	// off(methodName: any, method?: any) {
	// 	throw new Error("Method not implemented.");
	// }

}
