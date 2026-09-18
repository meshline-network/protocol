# Relay Discovery and Information Methods

[Client–relay protocol](../README.md) · [Discovery and session concepts](../concepts/discovery-and-sessions.md)

## `relay.descriptor`

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/relay/descriptor` |
| Session requirement | None |
| WSS | `relay.descriptor` |
| HTTP success status | `200 OK` |

### Request Parameters

None.

### Response Object

Success returns [`RelayDescriptor`](../core-objects/relay-descriptor.md#relaydescriptor) signed by this relay. Discovery entry points, business-address selection, and relay connection authentication follow [Relay discovery](../concepts/discovery-and-sessions.md#relay-discovery).

## `relay.info`

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/relay/info` |
| Session requirement | None |
| WSS | `relay.info` |
| HTTP success status | `200 OK` |

### Request Parameters

None.

### Response Object

| Field | Type | Required | Semantics |
|---|---|---|---|
| `relay_id` | string | Yes | [Relay ID](../../registry/core-objects.md#relay-id) in the Registry record |
| `name` | string | Yes | User-facing relay display name, not an identity; MUST contain at least one non-[whitespace character](../../general.md#text-whitespace-characters); at most 256 UTF-8 bytes |
| `server_time` | integer | Yes | Current relay Unix seconds |
| `limits` | object | Yes | Published service limits and retention policy; requests also face dynamic limits under [Resource and security controls](conventions.md#resource-and-security-controls) |

Callers MUST confirm response `relay_id` matches the verified `RelayDescriptor` used for this connection.

Fields of `limits`:

| Field | Type | Required | Semantics |
|---|---|---|---|
| `message_retention` | integer | Yes | Minimum retention in seconds for complete account timeline records; MUST be positive; see [Message retention and history gaps](../concepts/message-timeline.md#message-retention-and-history-gaps) |
| `channel_timeline_retention` | integer | Conditional | Required for channel hosting, otherwise may be omitted; positive minimum retention in seconds for channel events. Each event's minimum deadline uses the value at acceptance; later reduction does not expire existing events early |
| `max_channel_subscriptions` | integer | Conditional | Required for channel hosting with a WSS endpoint, otherwise may be omitted; maximum distinct channel IDs allowed when `channel.subscribe` adds subscriptions. MUST be nonnegative; `0` pauses additions while existing subscriptions may be retained, reduced, or cleared |
| `group_message_retention` | integer | Conditional | Required for group hosting, otherwise may be omitted; positive minimum retention in seconds for group message events |
| `max_group_members` | integer | Conditional | Required for group hosting, otherwise may be omitted; positive maximum member capacity for new groups and expansion. Later reduction does not invalidate existing members or capacity |
| `max_group_subscriptions` | integer | Conditional | Required for group hosting with a WSS endpoint, otherwise may be omitted; maximum distinct group IDs allowed when `group.subscribe` adds subscriptions. MUST be nonnegative; `0` pauses additions while existing subscriptions may be retained, reduced, or cleared |
| `max_group_invite_ttl` | integer | Conditional | Required for group hosting, otherwise may be omitted; positive maximum lifetime in seconds for newly created client invitations |
