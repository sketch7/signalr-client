import { HubConnection } from "../hub-connection";
import { vi } from "vitest";
// jest.genMockFromModule("@microsoft/signalr");
vi.mock("@microsoft/signalr");

let nextUniqueId = 0;

export interface HeroHub {
	UpdateHero: string;
}

export function createSUT(maximumAttempts: number): HubConnection<HeroHub> {
	return new HubConnection<HeroHub>({
		key: `hero-${nextUniqueId++}`,
		endpointUri: "/hero",
		defaultData: () => ({ tenant: "kowalski", power: "2000" }),
		options: {
			retry: {
				maximumAttempts,
				backOffStrategy: {
					delayRetriesMs: 10,
					maxDelayRetriesMs: 10
				}
			},
		}
	});
}

