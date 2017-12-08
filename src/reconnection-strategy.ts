import { ReconnectionStrategyOptions, BackOffStrategyOptions, RandomStrategyOptions } from "./hub-connection.model";
import { random } from "./utils/math";

export function getReconnectionDelay(retryOptions: ReconnectionStrategyOptions, retryCount: number): number {
	if (retryOptions.customStrategy) {
		return retryOptions.customStrategy(retryOptions, retryCount);
	}
	if (retryOptions.randomBackOffStrategy) {
		return randomBackOffStrategyDelay(retryOptions.randomBackOffStrategy, retryCount);
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

function randomBackOffStrategyDelay(randomStrategy: RandomStrategyOptions, retryCount: number) {
	let maxValue = Math.min(retryCount, randomStrategy.max);
	maxValue = randomStrategy.min >= maxValue ? (randomStrategy.min + 2) : maxValue;
	return random(randomStrategy.min, maxValue) * randomStrategy.intervalMs;
}

function backOffStrategyDelay(backOffStrategy: BackOffStrategyOptions, retryCount: number) {
	return Math.min(retryCount * backOffStrategy.delayRetriesMs, backOffStrategy.maxDelayRetriesMs);
}

function defaultStrategy(retryCount: number) {
	return randomBackOffStrategyDelay({ min: 3, max: 15, intervalMs: 1000 }, retryCount);
}