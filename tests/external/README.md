# External tests

The normal `pnpm test` command excludes this folder so unit tests remain
deterministic and do not silently depend on local infrastructure.

Run `pnpm test:external` to build `@uns-kit/core`, start an isolated Mosquitto
container on a dynamically allocated local port, and verify MQTT packet
transformation. Podman must be available; when it is not, the MQTT suite is
reported as skipped.

The GraphQL connectivity test is enabled by setting
`UNS_KIT_TEST_GRAPHQL_URL`. Set `UNS_KIT_TEST_GRAPHQL_TOKEN` as well when the
endpoint requires a bearer token. The token is never logged.

The 20,000-message MQTT load check is intentionally opt-in. Enable it with
`UNS_KIT_RUN_LOAD_TEST=1 pnpm test:external`.
