import { HubConnection as SignalRHubConnection } from "@aspnet/signalr-client";
import { fromPromise } from "rxjs/observable/fromPromise";
import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Observer } from "rxjs/Observer";
import { tap } from "rxjs/operators";

import { ConnectionState, ConnectionStatus, HubConnectionOptions } from "./hub-connection.model";

const connectedState: ConnectionState = { status: ConnectionStatus.connected };
const disconnectedState: ConnectionState = { status: ConnectionStatus.disconnected };

export class HubConnection<THub> {

	get connectionState$() { return this._connectionState$.asObservable(); }

	private source: string;
	private hubConnection: SignalRHubConnection;
	private hubConnectionOptions = new Subject<HubConnectionOptions>();
	private _connectionState$ = new BehaviorSubject<ConnectionState>(disconnectedState);

	constructor(connectionOption: HubConnectionOptions) {
		this.source = `[${connectionOption.key}] HubConnection ::`;
		this.hubConnectionOptions.subscribe(connection => {
			this.hubConnection = new SignalRHubConnection(connection.endpointUri, connection.options);
		});
		this.hubConnectionOptions.next(connectionOption);
	}

	connect(): Observable<void> {
		return fromPromise(this.hubConnection.start())
			.pipe(
			tap(() => {
				this._connectionState$.next(connectedState);

				this.hubConnection.onclose(err => {

					if (err) {
						console.error(`${this.source} session closed with errors`, err);
						this._connectionState$.next({ status: ConnectionStatus.disconnected, reason: "error", data: err });
					} else {
						this._connectionState$.next(disconnectedState);
					}
				});
			})
			); // .catchError();
	}

	on<TResult>(methodName: keyof THub): Observable<TResult> {
		return Observable.create((observer: Observer<TResult>): (() => void) | void => {
			const updateEvent = (latestValue: TResult) => observer.next(latestValue);
			this.hubConnection.on(methodName, updateEvent);
			return () => this.hubConnection.off(methodName, updateEvent);
		});
	}

	stream<TResult>(methodName: keyof THub, ...args: any[]): Observable<TResult> {
		return Observable.create((observer: Observer<TResult>): (() => void) | void => {
			this.hubConnection.stream<TResult>(methodName, ...args).subscribe({
				closed: false,
				next: item => observer.next(item),
				error: err => observer.error(err),
				complete: () => observer.complete()
			});
			return () => this.send("StreamUnsubscribe", methodName, ...args);
		});
	}

	send(methodName: keyof THub | "StreamUnsubscribe", ...args: any[]): Observable<void> {
		return fromPromise(this.hubConnection.send(methodName, ...args));
	}

	invoke<TResult>(methodName: keyof THub, ...args: any[]): Observable<TResult> {
		return fromPromise<TResult>(this.hubConnection.invoke(methodName, ...args));
	}

	disconnect() {
		if (this._connectionState$.value.status === ConnectionStatus.connected) {
			this.hubConnection.stop();
		}
	}
}