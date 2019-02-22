[projectUri]: https://github.com/sketch7/signalr-client
[projectGit]: https://github.com/sketch7/signalr-client.git
[changeLog]: ./CHANGELOG.md
[developmentWorkflowWiki]: ./docs/DEVELOPMENT-WORKFLOW.md
[apiWiki]: ./docs/API.md

[npm]: https://www.npmjs.com/package/@ssv/signalr-client

# @ssv/signalr-client
[![CircleCI](https://circleci.com/gh/sketch7/signalr-client.svg?style=shield)](https://circleci.com/gh/sketch7/signalr-client)
[![npm version](https://badge.fury.io/js/%40ssv%2Fsignalr-client.svg)](https://badge.fury.io/js/%40ssv%2Fsignalr-client)

SignalR client library built on top of **@aspnet/signalr**. This gives you more features and easier to use.

**Quick links**

[Change logs][changeLog] | [Project Repository][projectUri] | [API Documentation][apiWiki]

## Features
* Fully **TypeScript** and **ReactiveX**
* Multiple hub connections state management
* Connection state notifications 
* Update connection details easily without losing current connection state
* Subscriptions are handled through **RxJS** streams
* Reconnection strategies
    * Random strategy
    * BackOff strategy
    * Random BackOff strategy
    * Custom strategy
* Auto re-subscriptions after getting disconnected and re-connected
* Contains minimal dependencies (**SignalR** and **RxJS** only)
* **No constraints** with any framework
* Designed to be straight forward integrated with **any framework** such as *[Angular](#angular-adapter)*, *Aurelia*, *React*, *Vue*, etc...

## Samples
* Real world example (***coming soon***):
    * Client: Angular
    * Server: Microsoft Orleans integrated with SignalR
* [Angular basic example](#angular-basic-example)

## Installation

Get library via [npm]
```bash
npm install @ssv/signalr-client --save
```

## API Documentation
Check out the [API Documentation Page][apiWiki].


## Usage
There are **three simple steps**:

1. Register `HubConnectionFactory` in your DI eco system
2. In application bootstrap:
    * Register one or more hub connections (by injecting `HubConnectionFactory` and using `create`)
3. Somewhere in your components/services you need:
    * Inject `HubConnectionFactory` and call method `get` by passing the `key` for a specific hub connection, this will return `HubConnection`
    * Use `HubConnection` to use enhanced signalr features

## Angular Adapter
1. Register `HubConnectionFactory` as a **Provider**

You're all set! Now it's fully integrated with your Angular application.

Continue from the [vanilla usage - step 2](#usage) onwards

### Angular Basic Example
```ts
import { HubConnectionFactory } from "@ssv/signalr-client";

@NgModule({
	providers: [
		HubConnectionFactory,
		...
	]
})
export class AppModule {

    constructor(factory: HubConnectionFactory) {
		factory.create(
			{ key: "hero", endpointUri: "/hero" },
			{ key: "user", endpointUri: "/userNotifications" }
		);
	}
}
```

*sample usage in components:*
```ts
import { ISubscription } from "rxjs/Subscription";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { HubConnectionFactory, HubConnection } from "@ssv/signalr-client";

@Component({
	selector: "hero-detail",
	templateUrl: "./hero-detail.component.html"
})
export class HeroDetailComponent implements OnInit, OnDestroy {

	private hubConnection: HubConnection<HeroHub>;
	private hero$$: ISubscription;
  private hubConnection$$: ISubscription;

	constructor(hubFactory: HubConnectionFactory) {
		this.hubConnection = hubFactory.get<HeroHub>("hero");
	}

	ngOnInit(): void {
  	this.hubConnection$$ = this.hubConnection.connect()
			.subscribe(() => console.log(`connected!!`));
      
		this.hero$$ = this.hubConnection.stream<Hero>("GetUpdates", "singed")
		.subscribe(x => console.log(`hero stream :: singed :: update received`, x));
	}

	ngOnDestroy(): void {
		if (this.hero$$) {
			this.hero$$.unsubscribe();
		}
	}
}

export interface HeroHub {
	GetUpdates: string;
}

export interface Hero {
	id: string;
	name: string;
	health: number;
}
```

### Raw Basic Example
Create an instance of `HubConnectionFactory` ideally will be registered into your DI (if you're using any library) or you can create instance manually.

Step 1:
 - Register Hubs in the `HubConnectionFactory`
```ts
import { HubConnectionFactory, HubConnection } from "@ssv/signalr-client";

const hubFactory = new HubConnectionFactory();
hubFactory.create(
	{ key: "hero", endpointUri: "/hero" },
	{ key: "user", endpointUri: "http://localhost:62551/real-time/user" }
);
```

Step2:
- Get Hub by Key
- Connect
- subscribe for `on` 
```ts
const hubConnection = hubFactory.get<HeroHub>("hero");
const hubConnection$$ = hubConnection.connect().subscribe(() => {
	console.log(`connected!`);
});

const data$$ = hubConnection.on<string>("Send").subscribe(val => {
	console.log(`send :: data received >>>`, val);
});
```

### Contributions

Check out the [development guide][developmentWorkflowWiki].
