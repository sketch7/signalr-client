import { IHttpConnectionOptions, IHubProtocol } from "@aspnet/signalr";

import { Dictionary } from "./utils/dictionary";

export const errorCodes = {
	retryLimitsReached: "error.retry-limits-reached"
};

export enum DesiredConnectionStatus {
	disconnected = "disconnected",
	connected = "connected"
}

export enum ConnectionStatus {
	disconnected = "disconnected",
	connecting = "connecting",
	connected = "connected"
}

export enum InternalConnectionStatus {
	disconnected = "disconnected",
	ready = "ready",
	connected = "connected"
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
	defaultData?: () => Dictionary<string>; // todo: rename to getDefaultData
	/** @internal */
	getData?: () => Dictionary<string>;
	protocol?: IHubProtocol;
}

export interface ConnectionOptions extends IHttpConnectionOptions {
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