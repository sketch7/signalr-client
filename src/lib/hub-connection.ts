import { from, BehaviorSubject, Observable, Observer, timer, throwError, Subject, EMPTY, merge } from "rxjs";
import {
	tap, map, filter, switchMap, skipUntil, delay, first,
	retryWhen, delayWhen, distinctUntilChanged, takeUntil, retry,
	scan,
	catchError,
	skip,
	take,
} from "rxjs/operators";
import {
	HubConnection as SignalRHubConnection,
	HubConnectionBuilder as SignalRHubConnectionBuilder,
} from "@microsoft/signalr";

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
const connectingState = Object.freeze<ConnectionState>({ status: ConnectionStatus.connecting });

// todo: rename HubClient?
export class HubConnection<THub> {

	get connectionState(): ConnectionState { return this._connectionState$.value; }

	/** Gets the connection state. */
	get connectionState$(): Observable<ConnectionState> { return this._connectionState$.asObservable(); }

	/** Gets the key for the hub client. */
	get key(): string { return this._key; }

	/** Gets the `connectionId` of the hub connection (from SignalR). */
	get connectionId(): string | null { return this.hubConnection?.connectionId; }

	private _key: string;
	private source: string;
	private hubConnection!: SignalRHubConnection;
	private retry: ReconnectionStrategyOptions;
	private hubConnectionOptions$: BehaviorSubject<HubConnectionOptions>;
	private _connectionState$ = new BehaviorSubject<ConnectionState>(disconnectedState);
	private desiredState$ = new BehaviorSubject<DesiredConnectionStatus>(DesiredConnectionStatus.disconnected);
	private internalConnStatus$ = new BehaviorSubject<InternalConnectionStatus>(InternalConnectionStatus.disconnected);
	private connectionBuilder = new SignalRHubConnectionBuilder();
	private readonly _destroy$ = new Subject<void>();

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
				map(() => this.mergeConnectionData(connectionOpts)),
				map(buildQueryString),
				tap(queryString => {
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					this.connectionBuilder.withUrl(`${connectionOpts.endpointUri}${queryString}`, connectionOpts.options!);

					if (connectionOpts.protocol) {
						this.connectionBuilder = this.connectionBuilder.withHubProtocol(connectionOpts.protocol);
					}

					this.hubConnection = this.connectionBuilder.build();
					connectionOpts.configureSignalRHubConnection?.(this.hubConnection);
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
				tap(() => this.internalConnStatus$.next(InternalConnectionStatus.ready)),
				filter(() => prevConnectionStatus === InternalConnectionStatus.connected),
				switchMap(() => this.openConnection())
			)),
			takeUntil(this._destroy$),
		);
		const desiredDisconnected$ = this.desiredState$.pipe(
			filter(status => status === DesiredConnectionStatus.disconnected),
			// eslint-disable-next-line max-len
			// tap(status => console.warn(">>>> [desiredDisconnected$] desired disconnected", { internalConnStatus$: this.internalConnStatus$.value, desiredStatus: status })),
			tap(() => {
				if (this._connectionState$.value.status !== ConnectionStatus.disconnected) {
					// console.warn(">>>> [desiredDisconnected$] _disconnect");
					// note: ideally delayWhen disconnect first, though for some reason obs not bubbling
					this._disconnect();
				}
			}),
			tap(() => this._connectionState$.next(disconnectedState)),
			takeUntil(this._destroy$),
		);

		const reconnectOnDisconnect$ = this.reconnectOnDisconnect$().pipe(
			takeUntil(this._destroy$),
		);

		[
			desiredDisconnected$,
			reconnectOnDisconnect$,
			connection$
		].forEach((x: Observable<unknown>) => x.subscribe());
	}

	connect(data?: () => Dictionary<string>): Observable<void> {
		// console.warn("[connect] init", data);
		this.desiredState$.next(DesiredConnectionStatus.connected);
		if (this._connectionState$.value.status !== ConnectionStatus.disconnected) {
			console.warn(`${this.source} session already connecting/connected`);
			return emptyNext();
		}
		if (data) {
			this.setData(data);
		}
		// todo: refactor this and use subject only instead
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
			// tap(x => console.warn(">>>> connect - ready", x)),
		);
	}

	disconnect(): Observable<void> {
		// console.warn("[disconnect] init");
		this.desiredState$.next(DesiredConnectionStatus.disconnected);
		return this.untilDisconnects$();
	}

	setData(getData: () => Dictionary<string>): void {
		const connection = this.hubConnectionOptions$.value;
		connection.getData = getData;
		this.hubConnectionOptions$.next(connection);
	}

	on<TResult>(methodName: keyof THub): Observable<TResult> {
		const stream$: Observable<TResult> = new Observable((observer: Observer<TResult>): (() => void) | void => {
			const updateEvent = (latestValue: TResult) => observer.next(latestValue);
			this.hubConnection.on(methodName.toString(), updateEvent);
			return () => this.hubConnection.off(methodName.toString(), updateEvent);
		});

		return this.activateStreamWithRetry(stream$);
	}

	stream<TResult>(methodName: keyof THub, ...args: unknown[]): Observable<TResult> {
		const stream$: Observable<TResult> = new Observable((observer: Observer<TResult>): (() => void) | void => {
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

	send(methodName: keyof THub | "StreamUnsubscribe", ...args: unknown[]): Observable<void> {
		return from(this.hubConnection.send(methodName.toString(), ...args));
	}

	invoke<TResult>(methodName: keyof THub, ...args: unknown[]): Observable<TResult> {
		return from<Promise<TResult>>(this.hubConnection.invoke(methodName.toString(), ...args));
	}

	dispose(): void {
		this.disconnect();
		this.desiredState$.complete();
		this._connectionState$.complete();
		this.internalConnStatus$.complete();
		this._destroy$.next();
		this._destroy$.complete();
	}

	private _disconnect(): Observable<void> {
		// console.warn("[_disconnect] init", this.internalConnStatus$.value, this._connectionState$.value);
		return this._connectionState$.value.status !== ConnectionStatus.disconnected
			? from(this.hubConnection.stop())
			: emptyNext();
	}

	private untilDisconnects$(): Observable<void> {
		return this.connectionState$.pipe(
			first(state => state.status !== ConnectionStatus.connected),
			map(() => undefined),
		);
	}

	private untilDesiredDisconnects$(): Observable<void> {
		return this.desiredState$.pipe(
			first(state => state === DesiredConnectionStatus.disconnected),
			map(() => undefined),
		);
	}

	private openConnection() {
		// console.warn("[openConnection]");
		return emptyNext().pipe(
			// tap(x => console.warn(">>>> openConnection - attempting to connect", x)),
			tap(() => this._connectionState$.next(connectingState)),
			switchMap(() => from(this.hubConnection.start())),
			// tap(x => console.warn(">>>> [openConnection] - connection established", x)),
			retry({
				delay: (error, retryCount) => {
					if (this.retry.maximumAttempts && retryCount > this.retry.maximumAttempts) {
						return throwError(() => new Error(errorCodes.retryLimitsReached));
					}
					const nextRetryMs = getReconnectionDelay(this.retry, retryCount);
					// eslint-disable-next-line max-len
					console.debug(`${this.source} connect :: retrying`, { retryCount, maximumAttempts: this.retry.maximumAttempts, nextRetryMs });
					this._connectionState$.next({
						status: ConnectionStatus.connecting,
						reason: "reconnecting",
						data: { retryCount, maximumAttempts: this.retry.maximumAttempts, nextRetryMs }
					});
					// todo: refactor with subject instead e.g.
					this.hubConnectionOptions$.next(this.hubConnectionOptions$.value);

					return timer(nextRetryMs);
				}
			}),
			tap(() => this.internalConnStatus$.next(InternalConnectionStatus.connected)),
			tap(() => this._connectionState$.next(connectedState)),
			takeUntil(this.untilDesiredDisconnects$()),
		);
	}

	private activateStreamWithRetry<TResult>(stream$: Observable<TResult>): Observable<TResult> {
		return this.waitUntilConnect$.pipe(
			switchMap(() => stream$.pipe(
				retryWhen((errors: Observable<unknown>) => errors.pipe(
					delay(1), // workaround - when connection disconnects, stream errors fires before `signalr.onClose`
					delayWhen(() => this.waitUntilConnect$)
				))
			))
		);
	}

	private mergeConnectionData(options: HubConnectionOptions): Dictionary<string> {
		let data: Dictionary<string> = {};
		if (options.defaultData) {
			data = options.defaultData();
		}
		if (options.getData) {
			const specificData = options.getData();
			data = { ...data, ...specificData };
		}
		return data;
	}

	private reconnectOnDisconnect$(): Observable<void> {
		const onServerErrorDisconnect$ = this._connectionState$.pipe(
			filter(x => x.status === ConnectionStatus.disconnected && x.reason === errorReasonName),
		);

		// this is a fallback for when max attempts are reached and will emit to reset the max attempt after a duration
		const maxAttemptReset$ = onServerErrorDisconnect$.pipe(
			switchMap(() => this._connectionState$.pipe(
				switchMap(() => timer(this.retry.autoReconnectRecoverInterval || 900000)), // 15 minutes default
				take(1),
				takeUntil(
					this.connectionState$.pipe(
						filter(x => x.status === ConnectionStatus.connected)
					)
				),
			)),
			// tap(() => console.error(`${this.source} [reconnectOnDisconnect$] :: resetting max attempts`)),
		);

		const onDisconnect$ = this.desiredState$.pipe(
			filter(state => state === DesiredConnectionStatus.disconnected),
		);

		return merge(
			onDisconnect$,
			maxAttemptReset$,
		).pipe(
			switchMap(() => onServerErrorDisconnect$.pipe(
				scan(attempts => attempts += 1, 0),
				map(retryCount => ({
					retryCount,
					nextRetryMs: retryCount ? getReconnectionDelay(this.retry, retryCount) : 0
				})),
				switchMap(({ retryCount, nextRetryMs }) => {
					if (this.retry.maximumAttempts && retryCount > this.retry.maximumAttempts) {
						return throwError(() => new Error(errorCodes.retryLimitsReached));
					}

					const delay$ = !nextRetryMs
						? emptyNext()
						: timer(nextRetryMs).pipe(
							map(() => undefined)
						);
					return delay$.pipe(
						// tap(() => console.error(`${this.source} [reconnectOnDisconnect$] :: retrying`, {
						// 	retryCount,
						// 	nextRetryMs,
						// 	maximumAttempts: this.retry.maximumAttempts,
						// })),
						switchMap(() => this.connect()),
						// tap(() => console.error(">>>> [reconnectOnDisconnect$] connected")),
						takeUntil(this.untilDesiredDisconnects$()),
					);
				}),
				catchError(() => EMPTY),
				takeUntil(this.desiredState$.pipe(
					skip(1),
					filter(state => state === DesiredConnectionStatus.disconnected),
				)),
			)),
		);
	}

}
