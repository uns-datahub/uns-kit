# TODO

## Python parity (next steps)
- Implement TS-style handover manager semantics in `packages/uns-py`: subscribe to wildcard `active` and `handover` infra topics, keep new processes passive until timeout or handover completion, publish and handle `handover_intent`, `handover_request`, `handover_subscriber`, `handover_fin`, and `handover_ack`, and attach `processName`/`processId` user properties to active and handover packets.
- Add publisher/subscriber active-passive controls to the Python MQTT runtime: `setPublisherActive`, `setPublisherPassive`, `setSubscriberActive`, `setSubscriberPassive`, plus passive-drain behavior before handover completion.
- Add an async publish throttling queue so Python does not publish directly from the proxy path; preserve ordering, buffer across brief reconnects, and match the TS worker behavior closely enough for RTT handover use.
- Expand status parity with TS core: process-level `alive` and `uptime`, publisher/subscriber active flags, published/subscribed message count and byte metrics, and process identity on active status packets.
- Add produced API endpoint registry parity when Python gets an HTTP/API surface: mirror `@uns-kit/api` metadata shape and use full UNS identity (`topic + asset + objectType + objectId + attribute`) for endpoint keys and paths.
- Keep MQTT topic identity behavior as-is; full identity is already correct there.
