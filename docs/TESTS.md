# Test Specs

## connection specs

- given a disconnected connection
  - when connect is invoked
    - and while connecting disconnect was invoked
      - should disconnect
    - and hub is disposed
      - connect should complete* **implement**
    - and connected successfully
      x - should have status as connected
    - and fails to connect
      x - should retry
      - when disconnect is invoked
        x - should stop retying
      - when retry attempts limit reached
        x - should emit error
      - and while retrying disconnect was invoked
        - should disconnect

- given a connected connection
  - when disconnect is invoked
    x - should have status as disconnected
  - when disconnects
    x - should reconnect


## `setData` specs

- given a connected connection
  - when data changes
    x - should reconnect with new data
  - when data doesnt change
    - should not reconnect (xit **implement**)
- given a disconnected connection
  - when data changes
    x - should not connect


## `on` specs

- given a disconnected connection
  - when connects
      - and data is sent from server
        - should receive data

- given a connected connection
  - and data is sent from server
    - should receive data
  - and disconnects
    - should continue after reconnect

