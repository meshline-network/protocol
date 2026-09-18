# Client–Relay Notifications

[Client–relay protocol](../README.md)

## Common Notification Rules

### Notification Envelopes and Compatibility

Server notifications are sent only over WebSocket as JSON-RPC Notifications. `jsonrpc` MUST be `"2.0"`, `id` MUST be omitted, and `method` is the notification name. When parameters are defined, `params` MUST be the complete parameter object. Parameterless notifications may omit `params` or use `{}`.

Ignore unknown outer envelope fields under [WebSocket JSON-RPC](../methods/conventions.md#websocket-json-rpc); defined fields and `params` still follow their own validation rules.

Clients do not respond to notifications. Unknown notifications MUST be ignored for future extensibility. Notifications may be interleaved with JSON-RPC responses.

### Connection and Session Requirements

Only device-session connections may establish subscriptions and receive device-state, message, channel, or group notifications. Notifications may coalesce, duplicate, or be lost and cannot replace the corresponding reads or synchronization methods.

Successful same-connection [session renewal](../methods/authentication-and-sessions.md#websocket-session-renewal) retains still-valid notification enablement and subscriptions. Current access permissions and device revocation rules continue to apply.

### Notification Handling Rules

Notifications must satisfy connection identity, session, subscription, and object-binding requirements. Position or revision comparisons MUST be scoped to the same trusted network context, relay, resource, and current device's processing scope. Completed positions cannot be reused across accounts, channels, groups, or devices.

A notification carrying `head` may be ignored if it is no greater than the corresponding locally completed synchronization position. Other pending notifications may be coalesced into one catch-up. Receiving a notification or issuing a read does not advance position; the relevant read method determines advancement. Completion depends on its response and processing results. Filtering, deletion, or pruning may leave the last readable record below the notified head.

Without a comparable position or revision, notifications can only coalesce pending refresh needs for the same object. Identical parameters, an existing cache, or a just-completed read do not alone establish staleness. If list-change hints arrive after paginated reading starts and cannot be confirmed covered by that traversal, restart without a cursor; finishing remaining pages alone cannot clear the refresh need.

New hints received during a read remain pending and require catch-up unless coverage by that read can be confirmed. Read failure or incomplete processing likewise does not satisfy the need.

Filtering or coalescing notifications cannot clear known history gaps or other unsatisfied synchronization needs.

## `device.state.changed`

After accepting new `AccountDeviceState`, the account's current home relay sends `device.state.changed` to its still-valid online device-session connections, including other connections established by the device that submitted the update. Account sessions receive none. Connections of devices removed by the new state are invalidated directly and receive none. Pre-stored state produces no notification.

### Notification Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `revision` | integer | Yes | Revision of the accepted `AccountDeviceState` triggering this notification; MUST be a nonnegative [safe integer](../../general.md#safe-integers-and-counter-advancement) |

### Processing Rules

Within the same trusted network context and own-account scope, compare notification `revision` with complete device state locally verified and saved. A no-higher notification may be ignored. With no such state or a higher hint, call [`device.state.resolve`](../methods/device-state.md#devicestateresolve) to read complete own-device state, verify it, and update the cache.

Pending hints for one account may coalesce to the highest revision. Coverage may be confirmed only after a verified read result has `revision` no lower than the highest pending hint. A higher hint during the read, a failed read, or a still-lower result retains the need and requires catch-up under [Notification handling rules](#notification-handling-rules).

The notification carries no complete state and proves no device state. Receipt MUST NOT directly advance verified local revision or change device permissions. Ignoring or coalescing MUST NOT clear other unsatisfied refresh needs.

## `message.timeline.changed`

This notification is enabled only on WebSocket connections to the account's current home relay. On first successful `auth.device.verify` there, the relay MUST send the authentication success response before automatically enabling it.

### Notification Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `head` | integer | Yes | Account timeline head observed by the relay after appending the triggering record; MUST be nonnegative |

### Processing Rules

This is only a hint that unsynchronized records may exist for the current device. Handle it under [Notification handling rules](#notification-handling-rules), calling [`message.timeline.sync`](../methods/messaging.md#messagetimelinesync) when catch-up is needed. `head` may identify a record visible only to other devices, so reaching it cannot be the completion condition.

Clients are advised to call `message.timeline.sync` after first device authentication on the current home relay's WebSocket connection to catch records potentially missed before enablement. Renewal alone requires no additional synchronization. Determine position under [Message timeline processing](../concepts/message-timeline.md#message-timeline-processing-flow), and catch up from it after disconnection, notification loss, or relay restart. With no WSS endpoint or before reconnection, clients should synchronize periodically.
