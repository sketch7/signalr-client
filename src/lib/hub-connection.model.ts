import { HubConnection, IHttpConnectionOptions, IHubProtocol } from "@microsoft/signalr";

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
	data?: unknown;
}

export interface HubConnectionOptions {
	key: string;
	endpointUri: string;
	options?: ConnectionOptions;
	// todo: rename to getDefaultData or defaultDataFactory () => Dictionary<string> | Promise<Dictionary<string>>
	defaultData?: () => Dictionary<string>;
	/** @internal */
	getData?: () => Dictionary<string>;
	protocol?: IHubProtocol;
	/**
	 * Configures the SignalR Hub connection after it has been built (raw) in order to access/configure
	 * `serverTimeoutInMilliseconds`, `keepAliveIntervalInMilliseconds` etc...
	 */
	configureSignalRHubConnection?: (hubConnection: HubConnection) => void;
}

export interface ConnectionOptions extends IHttpConnectionOptions {
	retry?: ReconnectionStrategyOptions;
}

export interface ReconnectionStrategyOptions {
	maximumAttempts?: number;
	/**
	 * Resets maximum attempts when exhausted after the given duration. The duration is restarted for each connection attempt unless a Date is provided.
	 * Supports number in MS or date. Defaults to 15 minutes.
	 */
	autoReconnectRecoverInterval?: number | Date;
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
