import { HttpTransportType } from "@microsoft/signalr";

import { Dictionary } from "./utils/dictionary";
import { HubConnectionOptions } from "./hub-connection.model";
import { HubConnection } from "./hub-connection";

export class HubConnectionFactory {

	private source = "HubConnectionFactory ::";
	private hubConnections: Dictionary<HubConnection<unknown>> = {};

	create(...connectionOptions: HubConnectionOptions[]): this {
		for (const connectionOption of connectionOptions) {
			if (!connectionOption.key) {
				throw new Error(`${this.source} create :: connection key not set`);
			}
			if (!connectionOption.endpointUri) {
				throw new Error(`${this.source} create :: connection endpointUri not set for ${connectionOption.key}`);
			}
			if (!connectionOption.options) {
				connectionOption.options = {
					transport: HttpTransportType.WebSockets
				};
			} else if (!connectionOption.options.transport) {
				connectionOption.options.transport = HttpTransportType.WebSockets;
			}

			this.hubConnections[connectionOption.key] = new HubConnection<unknown>(connectionOption);
		}
		return this;
	}

	get<THub>(key: string): HubConnection<THub> {
		const hub = this.hubConnections[key];
		if (hub) {
			return hub;
		}
		throw new Error(`${this.source} get :: connection key not found '${key}'`);
	}

	remove(key: string): void {
		const hub = this.hubConnections[key];
		if (hub) {
			hub.dispose();
			delete this.hubConnections[key];
		}
	}

	connectAll(): void {
		// tslint:disable-next-line:forin
		for (const hubKey in this.hubConnections) {
			const hub = this.hubConnections[hubKey];
			hub.connect();
		}
	}

	disconnectAll(): void {
		// tslint:disable-next-line:forin
		for (const hubKey in this.hubConnections) {
			const hub = this.hubConnections[hubKey];
			hub.disconnect();
		}
	}

}