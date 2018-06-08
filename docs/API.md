
## Index

## [`HubConnectionFactory`](#hub-connection-factory)
* Methods
    * [`create`](#create)
    * [`get`](#get)
    * [`remove`](#remove)
    * [`connectAll`](#connectall)
    * [`disconnectAll`](#disconnectall)


## [`HubConnection`](#hub-connection)

* Properties
    * [`connectionState$`](#connectionstate)
* Methods
    * [`connect`](#connect)
    * [`setData`](#setdata)
    * [`on`](#on)
    * [`stream`](#stream)
    * [`send`](#send)
    * [`invoke`](#invoke)
    * [`disconnect`](#disconnect)


## Hub Connection Factory

### Methods

### `create`
Allow you register one or more hub connections.

| Parameters        | Type                        | Default | Required | Description      |
|-------------------|-----------------------------|---------|----------|------------------|
| connectionOptions | `...HubConnectionOptions[]` | -       | yes      | options          |

*Return* `HubConnectionFactory`


#### HubConnectionOptions

| Name        | Type                       | Default | Required | Description                                                                                                             |
|-------------|----------------------------|---------|----------|-------------------------------------------------------------------------------------------------------------------------|
| key         | `string`                   | -       | yes      | Friendly name.                                                                                                          |
| endpointUri | `string`                   | -       | yes      | Hub endpoint uri which is mapped with signalr hub. eg: `/userNotifications`.                                            |
| options     | `ConnectionOptions`        | -       | no       | SignalR connection options.                                                                                             |
| defaultData | `() => Dictionary<string>` | -       | no       | key value pair to be sent as query string to the server. This can be extended or overridden from `connect` or `setData` |
| protocol    | `IHubProtocol`             | -       | no       | Signalr connection protocol.                                                                                            |



### `get`
This will retrieve a hub connection by Key.

| Parameters | Type     | Default | Required | Description             |
|------------|----------|---------|----------|-------------------------|
| THub       | `THub`   | -       | yes      | Response type.          |
| key        | `string` | -       | yes      | Unique identifier.      |

*Return* `HubConnection<THub>`



### `remove`
Removes a specific hub connection by Key.

| Parameters | Type     | Default | Required | Description             |
|------------|----------|---------|----------|-------------------------|
| key        | `string` | -       | yes      | Unique identifier.      |

*Return* `void`



### `connectAll`
Iterates on all available connections and connects.

| Parameters | Type | Default | Required | Description |
|------------|------|---------|----------|-------------|
| -          | -    | -       | -        | -           |

*Return* `void`



### `disconnectAll`
Iterates on all available connections and disconnects.

| Parameters | Type | Default | Required | Description |
|------------|------|---------|----------|-------------|
| -          | -    | -       | -        | -           |

*Return* `void`




## Hub Connection

### Properties

### `connectionState$`
Subscribes for connection state updates.

*Return* `Observable<ConnectionState>`



### Methods

### `connect`
Connect with the specific hub connection.

*notes* 
* The `data` function will be triggered on every reconnect. This will allow any data which is stale (example: auth token) will be refreshed.


| Parameters | Type                        | Default | Required | Description                                                                                           |
|------------|-----------------------------|---------|----------|-------------------------------------------------------------------------------------------------------|
| data       | `() => Dictionary<string> ` | -       | -        | key value pair which will be sent as query string. This can will extend or override the `defaultData` |

*Return* `Observable<void>`



### `setData`
Send data with a specific connection as query string. 
When calling this method, it will automatically disconnects, sets data and depending the previous connection state it will either reconnect or not. 

*notes* 
* If before calling this method the connection was disconnected, this will only set the data.
* The `data` function will be triggered on every reconnect. This will allow any data which is stale (example: auth token) will be refreshed.

| Parameters | Type                        | Default | Required | Description                                                                                           |
|------------|-----------------------------|---------|----------|-------------------------------------------------------------------------------------------------------|
| data       | `() => Dictionary<string> ` | -       | -        | key value pair which will be sent as query string. This can will extend or override the `defaultData` |

*Return* `void`



### `on`
Subscribe to particular topic.

| Parameters | Type      | Default | Required | Description                                                        |
|------------|-----------|---------|----------|--------------------------------------------------------------------|
| TResult    | `TResult` | -       | yes      | TResult returned response.                                         |
| topicName  | `string`  | -       | yes      | Any data that will be dispatched on this topic will be received.   |

*Return* `Observable<TResult>`



### `stream`
Subscribe to particular stream on the server hub.

| Parameters | Type      | Default | Required | Description                                                                         |
|------------|-----------|---------|----------|-------------------------------------------------------------------------------------|
| TResult    | `TResult` | -       | yes      | TResult returned response.                                                          |
| methodName | `string`  | -       | yes      | `MethodName` which exists on the server hub.                                        |
| ...args    | `any[]`   | -       | no       | Any parameters which will be send to the server hub when invoking the `MethodName`. |

*Return* `Observable<TResult>`



### `send`
Dispatch a message to communicates with the server hub.

*note:* This doesn't return any response. If you need any response from the server hub use `invoke` instead.

| Parameters | Type     | Default | Required | Description                                                                         |
|------------|----------|---------|----------|-------------------------------------------------------------------------------------|
| methodName | `string` | -       | yes      | `MethodName` which exists on the server hub.                                        |
| ...args    | `any[]`  | -       | no       | Any parameters which will be send to the server hub when invoking the `MethodName`. |

*Return* `Observable<void>`



### `invoke`
Dispatch a message to communicates with the server hub and the server hub will return a response.

*note:* If you do not need to wait for any response, use `send` instead.

| Parameters | Type      | Default | Required | Description                                                                         |
|------------|-----------|---------|----------|-------------------------------------------------------------------------------------|
| TResult    | `TResult` | -       | yes      | TResult returned response.                                                          |
| methodName | `string`  | -       | yes      | `MethodName` which exists on the server hub.                                        |
| ...args    | `any[]`   | -       | no       | Any parameters which will be send to the server hub when invoking the `MethodName`. |

*Return* `Observable<TResult>`



### `disconnect`
Disconnect from a specific hub connection.

| Parameters | Type | Default | Required | Description |
|------------|------|---------|----------|-------------|
| -          | -    | -       | -        | -           |

*Return* `Observable<void>`