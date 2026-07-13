# @uns-kit/core migrations

Use this document when upgrading an existing application. Before changing
`@uns-kit/*` versions, record the installed source version and the intended
target version. Apply every migration whose version boundary is crossed; do not
apply migrations that are outside that range.

Agents must inspect the application's existing ownership and shutdown flow
before editing it. The examples below describe the intended behavior, not a
mechanical search-and-replace operation.

## 2.0.71 - MQTT publishing and shutdown lifecycle

Apply this migration when upgrading from `@uns-kit/core` `<2.0.71` to
`>=2.0.71`. No shutdown rewrite is required solely for an upgrade from
`2.0.71` or newer.

### Process-owned MQTT proxies

An MQTT proxy created by `UnsProxyProcess.createUnsMqttProxy()` is owned by that
process. Shut it down through `UnsProxyProcess.shutdown()` only. Do not flush or
stop the same proxy separately during normal process shutdown.

Before:

```ts
await mqttOutput.flush();
await mqttOutput.stop();
await unsProcess.shutdown();
```

After:

```ts
await unsProcess.shutdown();
```

`UnsProxyProcess.shutdown()` closes all process-owned proxies, waits for their
accepted publishes to drain, and attempts every cleanup even if one fails. It
rejects with an `AggregateError` when any cleanup fails, so callers must report
or otherwise handle that rejection.

Long-running applications should initiate this process-level shutdown from both
`SIGINT` and `SIGTERM`. Keep startup-failure cleanup on the same process-level
path as well.

### Standalone MQTT proxies

For an independently constructed `UnsMqttProxy`, call:

```ts
await proxy.stop();
```

`stop()` closes publish admission immediately and drains accepted work by
default. Repeated calls share the same result. Use
`await proxy.stop({ drain: false })` only when intentionally dropping queued
messages is acceptable.

### Publish completion and errors

- `publishMessage()` and `publishMqttMessage()` resolve when the bounded worker
  queue accepts a message, not when the broker confirms the publish.
- Call `await proxy.flush()` when the application needs all previously accepted
  messages to complete while the proxy remains running.
- A full bounded queue rejects the publish instead of creating an unbounded
  main-thread backlog. Decide whether the caller should retry, slow down, or
  fail.
- Asynchronous broker publish failures are emitted on the proxy `error` event.
  Keep an error listener or another explicit error-handling path.

### Upgrade check

For every affected application, verify all of the following:

- Identify whether each proxy is process-owned or standalone.
- Remove duplicate process-owned proxy `flush()` or `stop()` calls from the
  shutdown path.
- Handle rejection from `UnsProxyProcess.shutdown()` and standalone `stop()`.
- Confirm both `SIGINT` and `SIGTERM` use the intended shutdown owner.
- Confirm producers handle queue-full rejection at their required reliability
  level.
- Test that shutdown waits for accepted publishes and does not accept new work.
