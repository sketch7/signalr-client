<a name="0.7.1"></a>
## [0.7.1](https://github.com/sketch7/signalr-client/compare/0.7.0...0.7.1) (2018-06-05)


### Bug Fixes

* **hub connection:** expose signalr connection protocol ([63c2993](https://github.com/sketch7/signalr-client/commit/63c2993))



<a name="0.7.0"></a>
# [0.7.0](https://github.com/sketch7/signalr-client/compare/0.6.0...0.7.0) (2018-05-31)


### Features

* **packages:** upgrade signalr from `1.0.0-rc1-update1` to `1.0.0` ([de1a927](https://github.com/sketch7/signalr-client/commit/de1a927))



<a name="0.6.0"></a>
## [0.6.0](https://github.com/sketch7/signalr-client/compare/0.5.0...0.6.0) (2018-05-23)


### Features

* **packages:** upgrade rxjs from `5.5.0` to `6.2.0` ([61db6fc](https://github.com/sketch7/signalr-client/commit/61db6fc))



<a name="0.5.0"></a>
# [0.5.0](https://github.com/sketch7/signalr-client/compare/0.4.3...0.5.0) (2018-05-11)


### Features

* **signalr:** upgrade from `^1.0.0-alpha2-final` to `1.0.0-rc1-update1` ([2838c0b](https://github.com/sketch7/signalr-client/commit/2838c0b))



<a name="0.4.3"></a>
## [0.4.3](https://github.com/sketch7/signalr-client/compare/0.4.2...0.4.3) (2018-01-03)


### Bug Fixes

* **references:** switched `rxjs` reference from `dependencies` to `peerDependencies` ([ccaa7cf](https://github.com/sketch7/signalr-client/commit/ccaa7cf))



<a name="0.4.2"></a>
## [0.4.2](https://github.com/sketch7/signalr-client/compare/0.4.1...0.4.2) (2017-12-16)


### Bug Fixes

* **hub connection:** disconnects only when the connection status is set to `Connected` ([84cde61](https://github.com/sketch7/signalr-client/commit/84cde61))


### Features

* **hub connection:** `connect` has an optional parameter to `setData` before it connects ([99a6b8e](https://github.com/sketch7/signalr-client/commit/99a6b8e))
* **hub connection:** `clearData` has an optional parameter remove by keys or it will remove all ([99a6b8e](https://github.com/sketch7/signalr-client/commit/99a6b8e))


<a name="0.4.1"></a>
## [0.4.1](https://github.com/sketch7/signalr-client/compare/0.4.0...0.4.1) (2017-12-10)

### Code Refactoring

* **hub connection:**: now `on` and `stream` share same process to activate stream with retries


<a name="0.4.0"></a>
# [0.4.0](https://github.com/sketch7/signalr-client/compare/0.3.8...0.4.0) (2017-12-08)


### Code Refactoring

* **hub connection:** rework connection status + spit into two states. ([37aece7](https://github.com/sketch7/signalr-client/commit/37aece7))
* **hub connection:** rework internal flow

### BREAKING CHANGES

* **hub connection:** ConnectionStatus `ready` has been renamed to `connecting`

### Bug Fixes

* **hub connection:** fix `stream` dipose

<a name="0.3.8"></a>
## [0.3.8](https://github.com/sketch7/signalr-client/compare/0.3.7...0.3.8) (2017-12-08)

### Maintenance

* **packages:** cleaned up dependencies

<a name="0.3.7"></a>
## [0.3.7](https://github.com/sketch7/signalr-client/compare/0.3.6...0.3.7) (2017-12-08)


### Bug Fixes

* **reconnection strategy:** fix calculation in `randomBackOffStrategyDelay` ([3d58a12](https://github.com/sketch7/signalr-client/commit/3d58a12))



<a name="0.3.6"></a>
## [0.3.6](https://github.com/sketch7/signalr-client/compare/0.3.5...0.3.6) (2017-12-07)


### Features

* **hub connection:** auto re-subscriptions after getting disconnected and re-connected ([94102ae](https://github.com/sketch7/signalr-client/commit/94102ae))



<a name="0.3.5"></a>
## [0.3.5](https://github.com/sketch7/signalr-client/compare/0.3.4...0.3.5) (2017-12-06)


### Bug Fixes

* **package:**  rxjs reference now uses `caret` instead `tilde` ([0b03f63](https://github.com/sketch7/signalr-client/commit/0b03f63))



<a name="0.3.4"></a>
## [0.3.4](https://github.com/sketch7/signalr-client/compare/0.3.3...0.3.4) (2017-12-05)


### Bug Fixes

* **hub connection:** reconnection now triggers after server fails ([b8e369c](https://github.com/sketch7/signalr-client/commit/b8e369c))



<a name="0.3.3"></a>
## [0.3.3](https://github.com/sketch7/signalr-client/compare/0.3.2...0.3.3) (2017-12-05)


### Features

* **reconnection strategy:** add `randomBackOffStrategy` ([3bd046c](https://github.com/sketch7/signalr-client/commit/3bd046c))



<a name="0.3.2"></a>
## [0.3.2](https://github.com/sketch7/signalr-client/compare/0.3.1...0.3.2) (2017-12-04)


### Features

* **hub connection:** implemented reconnection strategies ([12cd84d](https://github.com/sketch7/signalr-client/commit/12cd84d))



<a name="0.3.1"></a>
## [0.3.1](https://github.com/sketch7/signalr-client/compare/0.3.0...0.3.1) (2017-12-02)


### Features

* **HubConnectionFactory:** implemented `connectAll` ([3a1d7f1](https://github.com/sketch7/signalr-client/commit/3a1d7f1))

### Documentation

* **readme:** update features, usages, angular adapter.
* **api:** add api documentation.
* **contribution:** add development guidelines.

<a name="0.3.0"></a>
# [0.3.0](https://github.com/sketch7/signalr-client/compare/0.2.0...0.3.0) (2017-12-02)


### Features

* **hub connection:** allow to `send` or `clear` extra data with connection ([6c5fea5](https://github.com/sketch7/signalr-client/commit/6c5fea5))

### Bug Fixes

* **hub connection:** fix `connect` & `disconnect` to validate connect state accordingly.

<a name="0.2.0"></a>
# [0.2.0](https://github.com/sketch7/signalr-client/compare/0.1.3...0.2.0) (2017-11-26)


### Bug Fixes

* **hub connection:** fix import namespace ([ce72b66](https://github.com/sketch7/signalr-client/commit/ce72b66))


### Features

* **hub connection:** implemented `HubConnection` basic features ([1e49510](https://github.com/sketch7/signalr-client/commit/1e49510))
* **hub connection factory:** implemented `HubConnectionFactory` basic features ([ad7c7b7](https://github.com/sketch7/signalr-client/commit/ad7c7b7))



<a name="0.1.3"></a>
## [0.1.3](https://github.com/sketch7/signalr-client/compare/0.1.1...0.1.3) (2017-11-26)



<a name="0.1.1"></a>
## 0.1.1 (2017-11-26)



