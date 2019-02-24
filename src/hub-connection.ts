import {
	tap, map, filter, switchMap, skipUntil, delay, first,
	retryWhen, scan, delayWhen, distinctUntilChanged, mapTo, takeUntil
} from "rxjs/operators";
import {
	HubConnection as SignalRHubConnection,
	HubConnectionBuilder as SignalRHubConnectionBuilder
} from "@aspnet/signalr";
import { from as fromPromise, BehaviorSubject, Observable, Observer, timer, throwError, iif } from "rxjs";

import {
	ConnectionState, ConnectionStatus, HubConnectionOptions,
	ReconnectionStrategyOptions, InternalConnectionStatus, errorCodes, DesiredConnectionStatus
} from "./hub-connection.model";
import { getReconnectionDelay } from "./reconnection-strategy";
import { buildQueryString } from "./utils/query-string";
import { Dictionary } from "./utils/dictionary";
import { emptyNext } from "./utils/rxjs";

const errorReasonName = "error";
const disconnectedState = Object.freeze<ConnectionState>({ status: ConnectionStatus.disconnected });
const connectedState = Object.freeze<ConnectionState>({ status: ConnectionStatus.connected });

export class HubConnection<THub> {


	/** todos:
	 * - dispose and complete subscriptions
	 */
	get connectionState$() { return this._connectionState$.asObservable(); }

	get key(): string { return this._key; }

	private _key: string;
	private source: string;
	private hubConnection!: SignalRHubConnection;
	private retry: ReconnectionStrategyOptions;
	private hubConnectionOptions$: BehaviorSubject<HubConnectionOptions>;
	private _connectionState$ = new BehaviorSubject<ConnectionState>(disconnectedState);
	private _desiredState$ = new BehaviorSubject<DesiredConnectionStatus>(DesiredConnectionStatus.disconnected);
	private internalConnStatus$ = new BehaviorSubject<InternalConnectionStatus>(InternalConnectionStatus.disconnected);
	private connectionBuilder = new SignalRHubConnectionBuilder();

	private waitUntilConnect$ = this.connectionState$.pipe(
		distinctUntilChanged((x, y) => x.status === y.status),
		skipUntil(this.connectionState$.pipe(filter(x => x.status === ConnectionStatus.connected)))
	);

	constructor(connectionOption: HubConnectionOptions) {
		this._key = connectionOption.key;
		this.source = `[${connectionOption.key}] HubConnection ::`;

		this.retry = connectionOption.options && connectionOption.options.retry ? connectionOption.options.retry : {};
		this.hubConnectionOptions$ = new BehaviorSubject<HubConnectionOptions>(connectionOption);

		const connection$ = this.hubConnectionOptions$.pipe(
			map(connectionOpts => [connectionOpts, this.internalConnStatus$.value] as [HubConnectionOptions, InternalConnectionStatus]),
			switchMap(([connectionOpts, prevConnectionStatus]) => this._disconnect().pipe(
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
					this.connectionBuilder.withUrl(`${connectionOpts.endpointUri}${queryString}`, connectionOpts.options!);

					if (connectionOpts.protocol) {
						this.connectionBuilder = this.connectionBuilder.withHubProtocol(connectionOpts.protocol);
					}
					this.hubConnection = this.connectionBuilder.build();
				}),
				tap(() => this.internalConnStatus$.next(InternalConnectionStatus.ready)),
				filter(() => prevConnectionStatus === InternalConnectionStatus.connected),
				tap(() => console.warn(">>> before open connection #2", prevConnectionStatus)),
				switchMap(() => this.openConnection())
			))
		);
		const desiredDisconnected$ = this._desiredState$.pipe(
			filter(status => status === DesiredConnectionStatus.disconnected),
			tap(status => console.warn(">>>> disconnected$", { internalConnStatus$: this.internalConnStatus$.value, desiredStatus: status })),
			tap(() => {
				if (this.internalConnStatus$.value === InternalConnectionStatus.connected) {
					this._disconnect();
				} else if (this.internalConnStatus$.value === InternalConnectionStatus.ready) {
					this._connectionState$.next(disconnectedState);
				}
			})
		);

		const reconnect$ = this._connectionState$.pipe(
			tap(x => console.warn(">>>> _connectionState$ state changed", x)),
			filter(x => x.status === ConnectionStatus.disconnected && x.reason === errorReasonName),
			tap(x => console.warn(">>>> reconnecting...", x)),
			switchMap(() => this.connect())
		);

		desiredDisconnected$.subscribe(); // todo: should we merge these?
		reconnect$.subscribe();
		connection$.subscribe();
	}

	connect(data?: () => Dictionary<string>): Observable<void> {
		console.info("triggered connect", data);
		this._desiredState$.next(DesiredConnectionStatus.connected);
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
			switchMap(() => this.openConnection()),
			tap(x => console.warn(">>>> connect - ready", x)),
		);
	}

	disconnect(): Observable<void> {
		console.info("triggered disconnect");
		this._desiredState$.next(DesiredConnectionStatus.disconnected);
		return this.untilDisconnects$();
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
		return fromPromise<Promise<TResult>>(this.hubConnection.invoke(methodName.toString(), ...args));
	}

	private _disconnect(): Observable<void> {
		console.info("triggered _disconnect", this.internalConnStatus$.value);
		return this.internalConnStatus$.value === InternalConnectionStatus.connected
			? fromPromise(this.hubConnection.stop())
			: emptyNext();
	}

	private untilDisconnects$(): Observable<void> {
		return this.connectionState$.pipe(
			first(state => state.status !== ConnectionStatus.connected),
			mapTo(undefined),
		);
	}

	private untilDesiredDisconnects$() {
		return this._desiredState$.pipe(
			first(state => state === DesiredConnectionStatus.disconnected),
			mapTo(undefined),
		);
	}

	private openConnection() {
		console.info("triggered openConnection");
		return emptyNext().pipe(
			tap(x => console.warn(">>>> openConnection - attempting to connect", x)),
			takeUntil(this.untilDesiredDisconnects$()),
			switchMap(() => fromPromise(this.hubConnection.start())),
			tap(x => console.warn(">>>> openConnection - connection established", x)),
			retryWhen(errors => errors.pipe(
				scan((errorCount: number) => ++errorCount, 0),
				delayWhen((retryCount: number) => {
					if (this.retry.maximumAttempts && retryCount > this.retry.maximumAttempts) {
						return throwError(new Error(errorCodes.retryLimitsReached));
					}
					const nextRetryMs = getReconnectionDelay(this.retry, retryCount);
					// tslint:disable-next-line:no-console
					console.warn(`${this.source} connect :: retrying`, { retryCount, maximumAttempts: this.retry.maximumAttempts, nextRetryMs });
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
			tap(x => console.warn(">>>> openConnection - state update", x)),
			tap(() => {
				this.hubConnection.onclose(err => {
					console.warn(">>>> openConnection - onclose", err);
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