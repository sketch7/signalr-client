import { IHubConnectionOptions } from "@aspnet/signalr";

import { Dictionary } from "./utils/dictionary";

export enum ConnectionStatus {
	disconnected,
	connecting,
	connected
}

export enum InternalConnectionStatus {
	disconnected,
	ready,
	connected
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
	retry?: ReconnectionStrategyOptions;
}

export interface ReconnectionStrategyOptions {
	maximumAttempts?: number;
	customStrategy?: (retryOptions: ReconnectionStrategyOptions, retryCount: number) => number;
	randomBackOffStrategy?: RandomStrategyOptions;
	randomStrategy?: RandomStrategyOptions;
	backOffStrategy?: BackOffStrategyOptions;
}

export interface RandomStrategyOptions {
	min: number;
	max: number;
	intervalMs: number;
}

export interface BackOffStrategyOptions {
	delayRetriesMs: number;
	maxDelayRetriesMs: number;
}
