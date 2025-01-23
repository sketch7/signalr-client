import { HubConnection } from "../hub-connection";
import { vi } from "vitest";
import { ReconnectionStrategyOptions } from "../hub-connection.model";
// jest.genMockFromModule("@microsoft/signalr");
vi.mock("@microsoft/signalr");

let nextUniqueId = 0;

export const RETRY_MAXIMUM_ATTEMPTS = 3;
export const AUTO_RECONNECT_RECOVER_INTERVAL = 2000;

export interface HeroHub {
	UpdateHero: string;
}

export function createSUT(retryOptions: ReconnectionStrategyOptions = {}): HubConnection<HeroHub> {
	const retry = {
		backOffStrategy: {
			delayRetriesMs: 10,
			maxDelayRetriesMs: 10
		},
		maximumAttempts: RETRY_MAXIMUM_ATTEMPTS,
		autoReconnectRecoverInterval: AUTO_RECONNECT_RECOVER_INTERVAL,
		...retryOptions,
	};
	return new HubConnection<HeroHub>({
		key: `hero-${nextUniqueId++}`,
		endpointUri: "/hero",
		defaultData: () => ({ tenant: "kowalski", power: "2000" }),
		options: {
			retry,
		}
	});
}

