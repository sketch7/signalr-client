## [4.1.0](https://github.com/sketch7/signalr-client/compare/4.0.0...4.1.0) (2022-11-24)

### Features

- **deps** update `@microsoft/signalr: ^7.0.0`

## [4.0.0](https://github.com/sketch7/signalr-client/compare/3.1.0...4.0.0) (2022-11-24)

### Features

- **deps** update `@microsoft/signalr: ^6.0.11`

### BREAKING CHANGES

- **angular:** **KNOWN ISSUE**: usage directly with angular when listening to changes seems to require zone now (usage with state works fine, and its suggested)
```ts
this.connection.on<Hero>("HeroChanged").pipe(
  // ... change ui
  // tap(() => this.cdr.markForCheck()), // used to work
  tap(() => this.ngZone.run(() => this.cdr.markForCheck())), // with @microsoft/signalr 6.x is not working without zone
).subscribe();
```

## [3.1.0](https://github.com/sketch7/signalr-client/compare/3.0.0...3.1.0) (2022-11-22)

### Features

- **hub connection:** ability to configure microsoft `HubConnection` directly via `configureSignalRHubConnection`

### Bug Fixes

- **hub connection:** correctly close the websocket connection when `disconnect` is called right after `connect`
- **hub connection:** `connectionState$` `connecting` will also be set when connecting not only when reconnecting

## [3.0.0](https://github.com/sketch7/signalr-client/compare/2.0.0...3.0.0) (2021-04-30)

### Features

- **signalr:** update from `@microsoft/signalr v3.0.0` to `@microsoft/signalr v5.0.5`
- **deps:** add dependency on `tslib: ^2.1.0`

### Refactor

- **lint:** fix all lint errors
- **all:** remove rxjs deprecations

### Chore

- **deps:** update all dev dependencies
- **ci:** update node version
- **lint:** migrate from tslint to eslint

## [2.0.0](https://github.com/sketch7/signalr-client/compare/1.1.2...2.0.0) (2019-10-22)

### Features

- **deps:** update from `@aspnet/signalr 1.1.4` to `@microsoft/signalr 3.0.0` (new package)

## [1.1.2](https://github.com/sketch7/signalr-client/compare/1.1.1...1.1.2) (2019-10-22)

### Bug Fixes

- **build:** fix rel build to be correctly as `rel`

## [1.1.1](https://github.com/sketch7/signalr-client/compare/1.1.0...1.1.1) (2019-06-11)

### Chore

*No new fixes/features in this release*

- **deps:** update dev dependencies
- **ci:** update node version

## [1.1.0](https://github.com/sketch7/signalr-client/compare/1.0.0...1.1.0) (2019-03-06)

### Features

- **hub connection:** connect now will throw error after being exhausted
- **hub connection:** add `dispose` which will complete all subscriptions
- **hub connection:** when retry limit reached now throws error

### Bug Fixes

- **hub connection:** when connecting and fails, during retring if `disconnect` is triggered was being ignored and will keep connecting


## [1.0.1](https://github.com/sketch7/signalr-client/compare/1.0.0...1.0.1) (2019-02-05)

### Bug Fixes

- **build:** revert build output - no features were added


## [1.0.0](https://github.com/sketch7/signalr-client/compare/0.8.1...1.0.0) (2019-01-24)

### Features

- **build:** change build output - no features were added
- **deps:** Update ASPNET SignalR version from `~1.0.0` to `~1.1.0`


## [0.8.1](https://github.com/sketch7/signalr-client/compare/0.8.0...0.8.1) (2018-10-26)

### Chore

- **build:** update CI and build tasks
- **all:** cleanup and update changes breaking changes
- **deps:** update all dependencies


## [0.8.0](https://github.com/sketch7/signalr-client/compare/0.7.1...0.8.0) (2018-06-08)

### Code Refactoring

- **hub connection:** rework `data` now requires to pass a function to refresh data upon every connect. ([f1566d9](https://github.com/sketch7/signalr-client/commit/f1566d9))


### BREAKING CHANGES

- **hub connection:** `connect` method now accepts `function` which returns `Dictionary<string>` instead `Dictionary<string>`
- **hub connection:** `setData` method now accepts `function` which returns `Dictionary<string>` instead `Dictionary<string>`
- **hub connection:** `clearData` method has been removed.


## [0.7.1](https://github.com/sketch7/signalr-client/compare/0.7.0...0.7.1) (2018-06-05)


### Bug Fixes

- **hub connection:** expose signalr connection protocol ([63c2993](https://github.com/sketch7/signalr-client/commit/63c2993))


## [0.7.0](https://github.com/sketch7/signalr-client/compare/0.6.0...0.7.0) (2018-05-31)

### Features

- **packages:** upgrade signalr from `1.0.0-rc1-update1` to `1.0.0` ([de1a927](https://github.com/sketch7/signalr-client/commit/de1a927))


## [0.6.0](https://github.com/sketch7/signalr-client/compare/0.5.0...0.6.0) (2018-05-23)


### Features

- **packages:** upgrade rxjs from `5.5.0` to `6.2.0` ([61db6fc](https://github.com/sketch7/signalr-client/commit/61db6fc))


## [0.5.0](https://github.com/sketch7/signalr-client/compare/0.4.3...0.5.0) (2018-05-11)


### Features

- **signalr:** upgrade from `^1.0.0-alpha2-final` to `1.0.0-rc1-update1` ([2838c0b](https://github.com/sketch7/signalr-client/commit/2838c0b))


## [0.4.3](https://github.com/sketch7/signalr-client/compare/0.4.2...0.4.3) (2018-01-03)


### Bug Fixes

- **references:** switched `rxjs` reference from `dependencies` to `peerDependencies` ([ccaa7cf](https://github.com/sketch7/signalr-client/commit/ccaa7cf))


## [0.4.2](https://github.com/sketch7/signalr-client/compare/0.4.1...0.4.2) (2017-12-16)


### Bug Fixes

- **hub connection:** disconnects only when the connection status is set to `Connected` ([84cde61](https://github.com/sketch7/signalr-client/commit/84cde61))


### Features

- **hub connection:** `connect` has an optional parameter to `setData` before it connects ([99a6b8e](https://github.com/sketch7/signalr-client/commit/99a6b8e))
- **hub connection:** `clearData` has an optional parameter remove by keys or it will remove all ([99a6b8e](https://github.com/sketch7/signalr-client/commit/99a6b8e))


## [0.4.1](https://github.com/sketch7/signalr-client/compare/0.4.0...0.4.1) (2017-12-10)

### Code Refactoring

- **hub connection:**: now `on` and `stream` share same process to activate stream with retries


## [0.4.0](https://github.com/sketch7/signalr-client/compare/0.3.8...0.4.0) (2017-12-08)


### Code Refactoring

- **hub connection:** rework connection status + spit into two states. ([37aece7](https://github.com/sketch7/signalr-client/commit/37aece7))
- **hub connection:** rework internal flow

### BREAKING CHANGES

- **hub connection:** ConnectionStatus `ready` has been renamed to `connecting`

### Bug Fixes

- **hub connection:** fix `stream` dipose



## [0.3.8](https://github.com/sketch7/signalr-client/compare/0.3.7...0.3.8) (2017-12-08)

### Chore

- **packages:** cleaned up dependencies


## [0.3.7](https://github.com/sketch7/signalr-client/compare/0.3.6...0.3.7) (2017-12-08)


### Bug Fixes

- **reconnection strategy:** fix calculation in `randomBackOffStrategyDelay` ([3d58a12](https://github.com/sketch7/signalr-client/commit/3d58a12))


## [0.3.6](https://github.com/sketch7/signalr-client/compare/0.3.5...0.3.6) (2017-12-07)


### Features

- **hub connection:** auto re-subscriptions after getting disconnected and re-connected ([94102ae](https://github.com/sketch7/signalr-client/commit/94102ae))


## [0.3.5](https://github.com/sketch7/signalr-client/compare/0.3.4...0.3.5) (2017-12-06)


### Bug Fixes

- **package:**  rxjs reference now uses `caret` instead `tilde` ([0b03f63](https://github.com/sketch7/signalr-client/commit/0b03f63))


## [0.3.4](https://github.com/sketch7/signalr-client/compare/0.3.3...0.3.4) (2017-12-05)


### Bug Fixes

- **hub connection:** reconnection now triggers after server fails ([b8e369c](https://github.com/sketch7/signalr-client/commit/b8e369c))


## [0.3.3](https://github.com/sketch7/signalr-client/compare/0.3.2...0.3.3) (2017-12-05)

### Features

- **reconnection strategy:** add `randomBackOffStrategy` ([3bd046c](https://github.com/sketch7/signalr-client/commit/3bd046c))


## [0.3.2](https://github.com/sketch7/signalr-client/compare/0.3.1...0.3.2) (2017-12-04)


### Features

- **hub connection:** implemented reconnection strategies ([12cd84d](https://github.com/sketch7/signalr-client/commit/12cd84d))


## [0.3.1](https://github.com/sketch7/signalr-client/compare/0.3.0...0.3.1) (2017-12-02)


### Features

- **HubConnectionFactory:** implemented `connectAll` ([3a1d7f1](https://github.com/sketch7/signalr-client/commit/3a1d7f1))

### Documentation

- **readme:** update features, usages, angular adapter.
- **api:** add api documentation.
- **contribution:** add development guidelines.


# [0.3.0](https://github.com/sketch7/signalr-client/compare/0.2.0...0.3.0) (2017-12-02)

### Features

- **hub connection:** allow to `send` or `clear` extra data with connection ([6c5fea5](https://github.com/sketch7/signalr-client/commit/6c5fea5))

### Bug Fixes

- **hub connection:** fix `connect` & `disconnect` to validate connect state accordingly.


## [0.2.0](https://github.com/sketch7/signalr-client/compare/0.1.3...0.2.0) (2017-11-26)


### Bug Fixes

- **hub connection:** fix import namespace ([ce72b66](https://github.com/sketch7/signalr-client/commit/ce72b66))

### Features

- **hub connection:** implemented `HubConnection` basic features ([1e49510](https://github.com/sketch7/signalr-client/commit/1e49510))
- **hub connection factory:** implemented `HubConnectionFactory` basic features ([ad7c7b7](https://github.com/sketch7/signalr-client/commit/ad7c7b7))


## 0.1.1 (2017-11-26)

initial release