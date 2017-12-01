import { IHubConnectionOptions } from "@aspnet/signalr-client/dist/src/IHubConnectionOptions";

import { Dictionary } from "./utils/dictionary";

export enum ConnectionStatus {
	connected,
	connectionReady,
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