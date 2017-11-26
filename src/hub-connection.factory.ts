import { HubConnectionOptions } from "./hub-connection.model";
import { HubConnection } from "./hub-connection";
import { Dictionary } from "./core/collection";

export class HubConnectionFactory {

	private hubConnections: Dictionary<HubConnection<any>> = {};

	create(...connectionOptions: HubConnectionOptions[]): this {
		for (const connectionOption of connectionOptions) {
			if (!connectionOption.key) {
				throw new Error(`HubConnectionFactory :: create :: connection key not set`);
			}
			if (!connectionOption.endpointUri) {
				throw new Error(`HubConnectionFactory :: create :: connection endpointUri not set for ${connectionOption.key}`);
			}
			this.hubConnections[connectionOption.key] = new HubConnection<any>(connectionOption);
		}
		return this;
	}

	get<THub>(key: string): HubConnection<THub> {
		const hub = this.hubConnections[key];
		if (hub) {
			return hub;
		}
		throw new Error(`HubConnectionFactory :: get :: connnection key not found '${key}'`);
	}

	remove(key: string) {
		const hub = this.hubConnections[key];
		if (hub) {
			hub.disconnect();
			delete this.hubConnections[key];
		}
	}

	disconnectAll() {
		// tslint:disable-next-line:forin
		for (const hubKey in this.hubConnections) {
			const hub = this.hubConnections[hubKey];
			hub.disconnect();
		}
	}

}