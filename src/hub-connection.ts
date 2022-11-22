import {
	tap, map, filter, switchMap, skipUntil, delay, first,
	retryWhen, scan, delayWhen, distinctUntilChanged, mapTo, takeUntil, finalize
} from "rxjs/operators";
import {
	HubConnection as SignalRHubConnection,
	HubConnectionBuilder as SignalRHubConnectionBuilder,
} from "@microsoft/signalr";
import { from as fromPromise, BehaviorSubject, Observable, Observer, timer, throwError, Subscription, merge, EMPTY } from "rxjs";

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

let seq = 0;
// todo: rename HubClient?
export class HubConnection<THub> {

	get connectionState$(): Observable<ConnectionState> { return this._connectionState$.asObservable(); }
	get key(): string { return this._key; }

	private _key: string;
	private source: string;
	private hubConnection!: SignalRHubConnection;
	private retry: ReconnectionStrategyOptions;
	private hubConnectionOptions$: BehaviorSubject<HubConnectionOptions>;
	private _connectionState$ = new BehaviorSubject<ConnectionState>(disconnectedState);
	private desiredState$ = new BehaviorSubject<DesiredConnectionStatus>(DesiredConnectionStatus.disconnected);
	private internalConnStatus$ = new BehaviorSubject<InternalConnectionStatus>(InternalConnectionStatus.disconnected);
	private connectionBuilder = new SignalRHubConnectionBuilder();
	private effects$$ = Subscription.EMPTY;

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
					this.hubConnection.onclose(err => {
						console.warn(">>> onClose")
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
			))
		);
		const desiredDisconnected$ = this.desiredState$.pipe(
			tap(status => console.warn(">>>> [desiredDisconnected$] PRE FILTER", { internalConnStatus$: this.internalConnStatus$.value, desiredStatus: status })),
			filter(status => status === DesiredConnectionStatus.disconnected),
			tap(status => console.warn(">>>> [desiredDisconnected$] desired disconnected", { internalConnStatus$: this.internalConnStatus$.value, desiredStatus: status })),
			switchMap(() => {
			// delayWhen(() => {
				if (this._connectionState$.value.status !== ConnectionStatus.disconnected) {
					console.warn(">>>> [desiredDisconnected$] _disconnect");
					return this._disconnect().pipe(
						tap(x => console.warn(">>>> [desiredDisconnected$] _disconnect$ complete", x)),
						finalize(() => console.warn(">>>> [desiredDisconnected$] finalize _disconnect$ complete")),
					);
				}
				return EMPTY;
				// switch (this._connectionState$.value) {
				// 	case ConnectionStatus.connected:
				// 	case ConnectionStatus.connecting:
				// 		this._disconnect();
				// 		break;
				// 	case InternalConnectionStatus.ready:
				// 		this._connectionState$.next(disconnectedState);
				// 		break;
				// 	// default:
				// 	// 	console.error("desiredDisconnected$ - State unhandled", this.internalConnStatus$.value);
				// 	// 	break;
				// }
			}),
			tap(x => console.warn(">>>> [desiredDisconnected$] DISCONNECTED", x)),
			tap(() => this._connectionState$.next(disconnectedState)),
		);

		const reconnectOnDisconnect = this._connectionState$.pipe(
			// tap(x => console.warn(">>>> _connectionState$ state changed", x)),
			filter(x => x.status === ConnectionStatus.disconnected && x.reason === errorReasonName),
			// tap(x => console.warn(">>>> reconnecting...", x)),
			switchMap(() => this.connect())
		);

		this.effects$$ = merge(
			desiredDisconnected$,
			reconnectOnDisconnect,
			connection$
		).subscribe();
	}

	connect(data?: () => Dictionary<string>): Observable<void> {
		console.warn("[connect] init", data, seq++);
		this.desiredState$.next(DesiredConnectionStatus.connected);
		if (this.internalConnStatus$.value === InternalConnectionStatus.connected) {
			console.warn(`${this.source} session already connected`);
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
		console.warn("[disconnect] init", seq++);
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
		return fromPromise(this.hubConnection.send(methodName.toString(), ...args));
	}

	invoke<TResult>(methodName: keyof THub, ...args: unknown[]): Observable<TResult> {
		return fromPromise<Promise<TResult>>(this.hubConnection.invoke(methodName.toString(), ...args));
	}

	dispose(): void {
		this.disconnect();
		this.desiredState$.complete();
		this._connectionState$.complete();
		this.internalConnStatus$.complete();
		this.effects$$.unsubscribe();
	}

	private _disconnect(): Observable<void> {
		console.warn("[_disconnect] init", this.internalConnStatus$.value, this._connectionState$.value, seq++);
		// return this.internalConnStatus$.value === InternalConnectionStatus.connected
		return this._connectionState$.value.status !== ConnectionStatus.disconnected
			// || this.hubConnection.state !== HubConnectionState.Disconnecting
			? fromPromise(this.hubConnection.stop()).pipe(
				tap(x => console.warn(">>>> [_disconnect] STOP complete", x)),
				finalize(() => console.warn(">>>> [_disconnect] finalize")),
			)
			: emptyNext();
	}

	private untilDisconnects$(): Observable<void> {
		return this.connectionState$.pipe(
			first(state => state.status !== ConnectionStatus.connected),
			tap(x => console.info(">>>> untilDisconnects$", x)),
			mapTo(undefined),
		);
	}

	private untilDesiredDisconnects$() {
		return this.desiredState$.pipe(
			first(state => state === DesiredConnectionStatus.disconnected),
			mapTo(undefined),
		);
	}

	private openConnection() {
		console.warn("[openConnection]");
		return emptyNext().pipe(
			// tap(x => console.warn(">>>> openConnection - attempting to connect", x)),
			tap(() => this._connectionState$.next(connectingState)),
			switchMap(() => fromPromise(this.hubConnection.start())),
			tap(x => console.warn(">>>> [openConnection] - connection established", x)),
			retryWhen(errors => errors.pipe(
				scan((errorCount: number) => ++errorCount, 0),
				delayWhen((retryCount: number) => {
					if (this.retry.maximumAttempts && retryCount > this.retry.maximumAttempts) {
						return throwError(new Error(errorCodes.retryLimitsReached));
					}
					const nextRetryMs = getReconnectionDelay(this.retry, retryCount);
					// tslint:disable-next-line:no-console
					console.debug(`${this.source} connect :: retrying`, { retryCount, maximumAttempts: this.retry.maximumAttempts, nextRetryMs });
					this._connectionState$.next({
						status: ConnectionStatus.connecting,
						reason: "reconnecting",
						data: { retryCount, maximumAttempts: this.retry.maximumAttempts, nextRetryMs }
					});
					// todo: refactor with subject instead e.g.
					this.hubConnectionOptions$.next(this.hubConnectionOptions$.value);

					return timer(nextRetryMs);
				})
			)),
			tap(() => this.internalConnStatus$.next(InternalConnectionStatus.connected)),
			tap(() => this._connectionState$.next(connectedState)),
			takeUntil(this.untilDesiredDisconnects$()
				.pipe(
					tap(x => console.warn(">>>> [openConnection] takeUntil Triggered", x)),
					tap(() => console.warn(">>>> [openConnection] takeUntil Triggered x2", this.hubConnection.state)),
					// tap(x => this.hubConnection.stop()),
					delay(1000),
					tap(() => console.warn(">>>> [openConnection] takeUntil Triggered x3", this.hubConnection.state)),
				)
			),

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

}