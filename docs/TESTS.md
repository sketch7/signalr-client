# Test Specs

## connection specs

- given a disconnected connection
  - when connect is invoked
    - and connected successfully
      x - should have status as connected
    - and fails to connect
      - should retry
      - when disconnect is invoked
        - should stop retying
      - when retry attempts limit reached
        - should emit error


- given a connected connection
  - when disconnect is invoked
    - should have status as disconnected
  - when disconnects
    - should reconnect

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

