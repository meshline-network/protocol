# Channel Notifications

[Channel hosting protocol](../README.md) · [Client–relay notifications](../../notifications/README.md) · [Channel subscription methods](../methods/subscription.md)

## `channel.timeline.changed`

`channel.timeline.changed` is sent by the relay to subscribed connections after appending timeline events.

The connection MUST have a valid device session and have subscribed to the channel through `channel.subscribe`.

Sending follows [Atomic commit and persistence rules](../concepts/model-and-timeline.md#atomic-commit-and-persistence-rules).

### Notification Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `channel_id` | string | Yes | Changed channel subscribed through `channel.subscribe` on this connection |
| `head` | integer | Yes | Latest committed channel timeline sequence when the notification is sent |

### Processing Rules

Handle hints under [Notification handling rules](../../notifications/README.md#notification-handling-rules), calling [`channel.read`](../methods/timeline.md#channelread) when events are needed.

After resubscription, notification loss, or without WSS, clients may still read retained events through `channel.read`.

Events are retained and cleaned up under [Channel retention rules](../concepts/model-and-timeline.md#channel-timeline-lifecycle). Clients MUST NOT treat notifications or saved sequences as proof that content still exists.
