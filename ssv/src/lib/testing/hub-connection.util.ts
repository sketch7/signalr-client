import { HubConnection } from "../hub-connection";

jest.genMockFromModule("@microsoft/signalr");
jest.mock("@microsoft/signalr");

let nextUniqueId = 0;

export interface HeroHub {
	UpdateHero: string;
}

export function createSUT(): HubConnection<HeroHub> {
	return new HubConnection<HeroHub>({
		key: `hero-${nextUniqueId++}`,
		endpointUri: "/hero",
		defaultData: () => ({ tenant: "kowalski", power: "2000" }),
		options: {
			retry: {
				maximumAttempts: 3,
				backOffStrategy: {
					delayRetriesMs: 10,
					maxDelayRetriesMs: 10
				}
			},
		}
	});
}

