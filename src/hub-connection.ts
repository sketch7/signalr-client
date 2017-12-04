import { tap, map, filter, switchMap, skipUntil, take, delay, first, retryWhen, scan, delayWhen, defaultIfEmpty } from "rxjs/operators";
import { HubConnection as SignalRHubConnection } from "@aspnet/signalr-client";
import { fromPromise } from "rxjs/observable/fromPromise";
import { timer } from "rxjs/observable/timer";
import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";

import { ConnectionState, ConnectionStatus, HubConnectionOptions, ReconnectionStrategyOptions } from "./hub-connection.model";
import { getReconnectionDelay } from "./reconnection-strategy";
import { buildQueryString } from "./utils/query-string";
import { Dictionary } from "./utils/dictionary";
import { emptyNext } from "./utils/rxjs";

const connectedState: ConnectionState = { status: ConnectionStatus.connected };
const connectionReadyState: ConnectionState = { status: ConnectionStatus.ready };
const disconnectedState: ConnectionState = { status: ConnectionStatus.disconnected };

export class HubConnection<THub> {

	get connectionState$() { return this._connectionState$.asObservable(); }

	private source: string;
	private hubConnection: SignalRHubConnection;
	private retry: ReconnectionStrategyOptions;
	private hubConnectionOptions$: BehaviorSubject<HubConnectionOptions>;
	private _connectionState$ = new BehaviorSubject<ConnectionState>(disconnectedState);

	constructor(connectionOption: HubConnectionOptions) {
		this.source = `[${connectionOption.key}] HubConnection ::`;

		this.retry = connectionOption.options && connectionOption.options.retry ? connectionOption.options.retry : {};
		this.hubConnectionOptions$ = new BehaviorSubject<HubConnectionOptions>(connectionOption);

		const reconnection$ = this.hubConnectionOptions$.pipe(
			// debounceTime(10),
			map(connectionOpts => [connectionOpts, this._connectionState$.value.status] as [HubConnectionOptions, ConnectionStatus]),
			switchMap(([connectionOpts, prevConnectionStatus]) => this.disconnect().pipe(
				map(() => buildQueryString(connectionOpts.data)),
				tap(queryString =>
					this.hubConnection = new SignalRHubConnection(`${connectionOpts.endpointUri}${queryString}`, connectionOpts.options)
				),
				tap(() => this._connectionState$.next(connectionReadyState)),
				filter(() => prevConnectionStatus === ConnectionStatus.connected),
				switchMap(() => this.openConnection())
			))
		);

		reconnection$.subscribe();
	}

	connect(): Observable<void> {
		if (this._connectionState$.value.status === ConnectionStatus.connected) {
			console.warn(`${this.source} session already connected`);
			return emptyNext();
		}

		return emptyNext().pipe(
			switchMap(() => this._connectionState$.pipe(
				tap(x => {
					if (x.status === ConnectionStatus.disconnected) {
						this.hubConnectionOptions$.next(this.hubConnectionOptions$.value);
					}
				}),
				skipUntil(this._connectionState$.pipe(filter(x => x.status === ConnectionStatus.ready))),
				first()
			)),
			switchMap(() => this.openConnection())
		);
	}

	setData(data: Dictionary<string> | undefined | null) {
		if (!data) {
			this.clearData();
			return;
		}
		const connection = this.hubConnectionOptions$.value;
		connection.data = { ...connection.data, ...data } as Dictionary<string>;
		this.hubConnectionOptions$.next(connection);
	}

	clearData() {
		const connection = this.hubConnectionOptions$.value;
		connection.data = undefined;
		this.hubConnectionOptions$.next(connection);
	}

	on<TResult>(topicName: keyof THub): Observable<TResult> {
		return Observable.create((observer: Observer<TResult>): (() => void) | void => {
			const updateEvent = (latestValue: TResult) => observer.next(latestValue);
			this.hubConnection.on(topicName, updateEvent);
			return () => this.hubConnection.off(topicName, updateEvent);
		});
	}

	stream<TResult>(methodName: keyof THub, ...args: any[]): Observable<TResult> {
		const stream$: Observable<TResult> = Observable.create((observer: Observer<TResult>): (() => void) | void => {
			this.hubConnection.stream<TResult>(methodName, ...args).subscribe({
				closed: false,
				next: item => observer.next(item),
				error: err => {
					if (err && err.message !== "Invocation cancelled due to connection being closed.") {
						observer.error(err);
					}
				},
				complete: () => observer.complete()
			});
			return () => {
				if (this._connectionState$.value.status === ConnectionStatus.connected) {
					this.send("StreamUnsubscribe", methodName, ...args);
				}
			};
		});
		return emptyNext().pipe(
			switchMap(() => this.connectionState$.pipe(
				skipUntil(this.connectionState$.pipe(filter(x => x.status === ConnectionStatus.connected))),
				first()
			)),
			tap(() => console.log(`${this.source} stream - start`)),
			switchMap(() => stream$) // todo: retry after reconnection
		);
	}

	send(methodName: keyof THub | "StreamUnsubscribe", ...args: any[]): Observable<void> {
		return fromPromise(this.hubConnection.send(methodName, ...args));
	}

	invoke<TResult>(methodName: keyof THub, ...args: any[]): Observable<TResult> {
		return fromPromise<TResult>(this.hubConnection.invoke(methodName, ...args));
	}

	disconnect() {
		if (this._connectionState$.value.status === ConnectionStatus.disconnected) {
			return emptyNext();
		}

		return emptyNext().pipe(
			tap(() => this.hubConnection.stop()),
			delay(200) // workaround since signalr are returning void and internally firing a callback for disconnect
		);
	}

	private openConnection() {
		return emptyNext().pipe(
			switchMap(() => fromPromise(this.hubConnection.start())),
			retryWhen((errors: Observable<any>) => errors.pipe(
				scan((errorCount: number) => ++errorCount, 0),
				this.retry.maximumAttempts ? take(this.retry.maximumAttempts) : defaultIfEmpty(),
				delayWhen((retryCount: number) => {
					const delayRetries = getReconnectionDelay(this.retry, retryCount);
					// tslint:disable-next-line:no-console
					console.debug(`${this.source} connect :: retrying`, { retryCount, maximumAttempts: this.retry.maximumAttempts, delayRetries });
					this.hubConnectionOptions$.next(this.hubConnectionOptions$.value);
					return timer(delayRetries);
				})
			)),
			tap(() => this._connectionState$.next(connectedState)),
			tap(() => {
				this.hubConnection.onclose(err => {
					if (err) {
						console.error(`${this.source} session disconnected with errors`, err);
						this._connectionState$.next({ status: ConnectionStatus.disconnected, reason: "error", data: err });
					} else {
						console.warn(`${this.source} session disconnected`);
						this._connectionState$.next(disconnectedState);
					}
				});
			}),
			first()
		);
	}
}