import { IHubConnectionOptions } from "@aspnet/signalr-client/dist/src/IHubConnectionOptions";

import { Dictionary } from "./core/collection";

export enum ConnectionStatus {
	connected,
	disconnected
}

export interface ConnectionState {
	status: ConnectionStatus;
	reason?: string;
	data?: any;
}

export interface HubConnectionOptions {
	key: string;
	endpointUri: string;
	options?: ConnectionOptions;
	data?: Dictionary<string>;
}

export interface ConnectionOptions extends IHubConnectionOptions {

}