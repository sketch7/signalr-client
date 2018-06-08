import {
	tap, map, filter, switchMap, skipUntil, take, delay, first,
	retryWhen, scan, delayWhen, defaultIfEmpty, distinctUntilChanged
} from "rxjs/operators";
import {
	HubConnection as SignalRHubConnection,
	HubConnectionBuilder as SignalRHubConnectionBuilder
} from "@aspnet/signalr";
import { from as fromPromise, timer, BehaviorSubject, Observable, Observer } from "rxjs";
// import { fromPromise } from "rxjs/observable/fromPromise";
// import { timer } from "rxjs/observable/timer";
// import { BehaviorSubject } from "rxjs/BehaviorSubject";
// import { Observable } from "rxjs/Observable";
// import { Observer } from "rxjs/Observer";

import {
	ConnectionState, ConnectionStatus, HubConnectionOptions,
	ReconnectionStrategyOptions, InternalConnectionStatus
} from "./hub-connection.model";
import { getReconnectionDelay } from "./reconnection-strategy";
import { buildQueryString } from "./utils/query-string";
import { Dictionary } from "./utils/dictionary";
import { emptyNext } from "./utils/rxjs";

const errorReasonName = "error";
const disconnectedState: ConnectionState = { status: ConnectionStatus.disconnected };
const connectedState: ConnectionState = { status: ConnectionStatus.connected };

export class HubConnection<THub> {

	get connectionState$() { return this._connectionState$.asObservable(); }

	private source: string;
	private hubConnection!: SignalRHubConnection;
	private retry: ReconnectionStrategyOptions;
	private hubConnectionOptions$: BehaviorSubject<HubConnectionOptions>;
	private _connectionState$ = new BehaviorSubject<ConnectionState>(disconnectedState);
	private internalConnStatus$ = new BehaviorSubject<InternalConnectionStatus>(InternalConnectionStatus.disconnected);

	private waitUntilConnect$ = this.connectionState$.pipe(
		distinctUntilChanged((x, y) => x.status === y.status),
		skipUntil(this.connectionState$.pipe(filter(x => x.status === ConnectionStatus.connected)))
	);

	constructor(connectionOption: HubConnectionOptions) {
		this.source = `[${connectionOption.key}] HubConnection ::`;

		this.retry = connectionOption.options && connectionOption.options.retry ? connectionOption.options.retry : {};
		this.hubConnectionOptions$ = new BehaviorSubject<HubConnectionOptions>(connectionOption);

		const connection$ = this.hubConnectionOptions$.pipe(
			map(connectionOpts => [connectionOpts, this.internalConnStatus$.value] as [HubConnectionOptions, InternalConnectionStatus]),
			switchMap(([connectionOpts, prevConnectionStatus]) => this.disconnect().pipe(
				map(() => {
					let data: Dictionary<string> = {};
					if (connectionOpts.defaultData) {
						data = connectionOpts.defaultData();
					}
					if (connectionOpts.data) {
						const specificData = connectionOpts.data();
						data = { ...data, ...specificData };
					}
					return data;
				}),
				map(buildQueryString),
				tap(queryString => {
					let connectionBuilder = new SignalRHubConnectionBuilder()
						.withUrl(`${connectionOpts.endpointUri}${queryString}`, connectionOpts.options as any); // hack since signalr typings are incorrect.

					if (connectionOpts.protocol) {
						connectionBuilder = connectionBuilder.withHubProtocol(connectionOpts.protocol);
					}

					this.hubConnection = connectionBuilder.build();
				}
				),
				tap(() => this.internalConnStatus$.next(InternalConnectionStatus.ready)),
				filter(() => prevConnectionStatus === InternalConnectionStatus.connected),
				switchMap(() => this.openConnection())
			))
		);

		const reconnect$ = this._connectionState$.pipe(
			filter(x => x.status === ConnectionStatus.disconnected && x.reason === errorReasonName),
			switchMap(() => this.connect())
		);

		reconnect$.subscribe();
		connection$.subscribe();
	}

	connect(data?: () => Dictionary<string>): Observable<void> {
		if (this.internalConnStatus$.value === InternalConnectionStatus.connected) {
			console.warn(`${this.source} session already connected`);
			return emptyNext();
		}
		if (data) {
			this.setData(data);
		}

		return emptyNext().pipe(
			switchMap(() => this.internalConnStatus$.pipe(
				tap(x => {
					if (x === InternalConnectionStatus.disconnected) {
						this.hubConnectionOptions$.next(this.hubConnectionOptions$.value);
					}
				}),
				skipUntil(this.internalConnStatus$.pipe(filter(x => x === InternalConnectionStatus.ready))),
				first()
			)),
			switchMap(() => this.openConnection())
		);
	}

	setData(data: () => Dictionary<string>) {
		const connection = this.hubConnectionOptions$.value;
		connection.data = data;
		this.hubConnectionOptions$.next(connection);
	}

	on<TResult>(methodName: keyof THub): Observable<TResult> {
		const stream$: Observable<TResult> = Observable.create((observer: Observer<TResult>): (() => void) | void => {
			const updateEvent = (latestValue: TResult) => observer.next(latestValue);
			this.hubConnection.on(methodName.toString(), updateEvent);
			return () => this.hubConnection.off(methodName.toString(), updateEvent);
		});

		return this.activateStreamWithRetry(stream$);
	}

	stream<TResult>(methodName: keyof THub, ...args: any[]): Observable<TResult> {
		const stream$: Observable<TResult> = Observable.create((observer: Observer<TResult>): (() => void) | void => {
			this.hubConnection.stream<TResult>(methodName.toString(), ...args).subscribe({
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
				emptyNext().pipe(
					delay(1), // workaround - when connection disconnects, stream errors fires before `signalr.onClose`
					filter(() => this.internalConnStatus$.value === InternalConnectionStatus.connected),
					switchMap(() => this.send("StreamUnsubscribe", methodName, ...args))
				).subscribe();
			};
		});

		return this.activateStreamWithRetry(stream$);
	}

	send(methodName: keyof THub | "StreamUnsubscribe", ...args: any[]): Observable<void> {
		return fromPromise(this.hubConnection.send(methodName.toString(), ...args));
	}

	invoke<TResult>(methodName: keyof THub, ...args: any[]): Observable<TResult> {
		return fromPromise<TResult>(this.hubConnection.invoke(methodName.toString(), ...args));
	}

	disconnect() {
		if (this.internalConnStatus$.value !== InternalConnectionStatus.connected) {
			return emptyNext();
		}

		return fromPromise(this.hubConnection.stop());
	}

	private openConnection() {
		return emptyNext().pipe(
			switchMap(() => fromPromise(this.hubConnection.start())),
			retryWhen((errors: Observable<any>) => errors.pipe(
				scan((errorCount: number) => ++errorCount, 0),
				this.retry.maximumAttempts ? take(this.retry.maximumAttempts) : defaultIfEmpty(),
				delayWhen((retryCount: number) => {
					const nextRetryMs = getReconnectionDelay(this.retry, retryCount);
					// tslint:disable-next-line:no-console
					console.debug(`${this.source} connect :: retrying`, { retryCount, maximumAttempts: this.retry.maximumAttempts, nextRetryMs });
					this._connectionState$.next({
						status: ConnectionStatus.connecting,
						reason: "reconnecting",
						data: { retryCount, maximumAttempts: this.retry.maximumAttempts, nextRetryMs }
					});
					this.hubConnectionOptions$.next(this.hubConnectionOptions$.value);
					return timer(nextRetryMs);
				})
			)),
			tap(() => this.internalConnStatus$.next(InternalConnectionStatus.connected)),
			tap(() => this._connectionState$.next(connectedState)),
			tap(() => {
				this.hubConnection.onclose(err => {
					this.internalConnStatus$.next(InternalConnectionStatus.disconnected);
					if (err) {
						console.error(`${this.source} session disconnected with errors`, { name: err.name, message: err.message });
						this._connectionState$.next({
							status: ConnectionStatus.disconnected,
							reason: errorReasonName,
							data: { name: err.name, message: err.message }
						});
					} else {
						console.warn(`${this.source} session disconnected`);
						this._connectionState$.next(disconnectedState);
					}
				});
			}),
			first()
		);
	}

	private activateStreamWithRetry<TResult>(stream$: Observable<TResult>): Observable<TResult> {
		return this.waitUntilConnect$.pipe(
			switchMap(() => stream$.pipe(
				retryWhen((errors: Observable<any>) => errors.pipe(
					delay(1), // workaround - when connection disconnects, stream errors fires before `signalr.onClose`
					delayWhen(() => this.waitUntilConnect$)
				))
			))
		);
	}

}