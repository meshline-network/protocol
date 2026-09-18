# Channel Subscription Methods

[Channel hosting protocol](../README.md) · [Common method conventions](../../methods/conventions.md)

## `channel.subscribe`

`channel.subscribe` atomically replaces the current WebSocket connection's channel subscription set. Success enables [`channel.timeline.changed`](../notifications/README.md#channeltimelinechanged) for those channels.

| Item | Convention |
|---|---|
| HTTP | Unsupported |
| Session requirement | Device session |
| WSS | `channel.subscribe` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `channel_ids` | array&lt;string&gt; | Yes | Complete desired subscription set after success; empty clears all subscriptions; no duplicates; every channel MUST be hosted by this relay; count follows the limits below |

### Response Object

None.

### Processing and Errors

First validate parameters and device session. Duplicate or invalid IDs, or count-limit violations, return `bad_request`; invalid sessions return `unauthorized`; wrong mode returns `forbidden`.

Count checks use the connection's still-valid set immediately before replacement. If any requested channel is not already subscribed, the complete new count MUST NOT exceed current `relay.info.limits.max_channel_subscriptions`. Without additions, a still-over-limit count alone MUST NOT cause rejection. Array order does not affect set comparison.

If any channel is missing or hosted elsewhere, return `not_found` with this [JSON-RPC error](../../methods/conventions.md#error-responses) `data`:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `channel_ids` | array&lt;string&gt; | Yes | All requested IDs that cannot be subscribed; nonempty, distinct, each drawn from request `channel_ids` |

After all checks pass, atomically replace the set. Any failure preserves the original set.
