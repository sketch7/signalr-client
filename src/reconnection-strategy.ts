import { ReconnectionStrategyOptions, BackOffStrategyOptions, RandomStrategyOptions } from "./hub-connection.model";
import { random } from "./utils/math";

export function getDelay(retryOptions: ReconnectionStrategyOptions, retryCount: number): number {
	if (retryOptions.customStrategy) {
		return retryOptions.customStrategy(retryOptions, retryCount);
	}
	if (retryOptions.backOffStrategy) {
		return backOffStrategyDelay(retryOptions.backOffStrategy, retryCount);
	}
	if (retryOptions.randomStrategy) {
		return randomStrategyDelay(retryOptions.randomStrategy);
	}
	return defaultStrategy(retryCount);
}

function randomStrategyDelay(randomStrategy: RandomStrategyOptions) {
	return random(randomStrategy.min, randomStrategy.max) * randomStrategy.intervalMs;
}

function backOffStrategyDelay(backOffStrategy: BackOffStrategyOptions, retryCount: number) {
	return Math.min(retryCount * backOffStrategy.delayRetriesMs, backOffStrategy.maxDelayRetriesMs);
}

function defaultStrategy(retryCount: number) {
	return backOffStrategyDelay({ delayRetriesMs: 1000, maxDelayRetriesMs: 15000 }, retryCount);
}