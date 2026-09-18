# Message Methods

[Client–relay protocol](../README.md) · [Common method conventions](conventions.md) · [Messages and content](../core-objects/messages-and-content.md) · [Message delivery](../concepts/message-delivery.md) · [Account message timeline](../concepts/message-timeline.md) · [Home relay changes](../concepts/account-and-device-lifecycle.md#home-relay-changes)

## `message.send`

Submit an encrypted, signed message to the sender account's current home relay, which assumes delivery responsibility. Each message targets one account.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/message/send` |
| Session requirement | Device session |
| WSS | `message.send` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `envelope` | MessageEnvelope | Yes | [Encrypted message envelope](../core-objects/messages-and-content.md#messageenvelope); `from` and `from_device_id` MUST match the device session's account and device, respectively |
| `recipient_boxes` | array&lt;MessageKeyBox&gt; | Yes | Wrap the content key for recipient-account devices under [Recipient message key boxes](../core-objects/messages-and-content.md#recipient-message-key-boxes) |
| `sender_boxes` | array&lt;MessageKeyBox&gt; | No | Optional for non-self-delivery; omission creates no sent timeline record. MUST be omitted for self-delivery. Wrap the same content key for sender-account devices under [Sender message key boxes](../core-objects/messages-and-content.md#sender-message-key-boxes) |
| `authorization` | [ContactGrant](../concepts/contacts.md#contactgrant) or [ContactInvite](../concepts/contacts.md#contactinvite) | No | Grant from recipient to sender, or invitation issued by recipient; omitted for self-delivery and may be omitted for public bootstrap delivery |

For public bootstrapping and credential-authorized receiving conditions, see [Message delivery](../concepts/message-delivery.md#receiving-validation-rules).

### Successful Response

Returns [`DeliveryStatus`](../concepts/message-delivery.md#deliverystatus), meaning the relay accepted the request. `status` is the currently known delivery state. Failure of delivery after acceptance still returns a successful response with result `status` equal to `failed`.

### Error Response

If the relay has not accepted the request, the call fails without creating a sent record or delivery responsibility. Principal errors are below; others follow [Common method conventions](conventions.md#error-codes):

| Condition | Error code |
|---|---|
| A known valid current route points elsewhere | `route_stale` |
| This relay cannot confirm it is the sender's current home relay | `target_not_local` |
| Envelope creation time exceeds local future clock tolerance | `clock_skew` |
| This relay's delivery age limit has been exceeded | `message_expired` |
| Sender boxes are supplied but all their devices are unavailable, or all recipient devices are found unavailable before acceptance | `device_unknown` |

### Processing Rules

Every call must pass device-session authentication and confirm this relay is designated by the sender's currently valid route. Other relays do not forward this method. Repeated requests follow [Idempotent message retries](../concepts/message-delivery.md#idempotent-message-retries).

Before accepting a new request, the relay verifies the original envelope signature, envelope and box constraints, authorization material, and size limits, and validates `created_at` against its own clock tolerance and delivery age limit.

Sent records after acceptance, receiving validation, and further delivery follow [Delivery flow](../concepts/message-delivery.md#delivery-flow). Self-delivery must finish receiving validation and accept the message within this call.

## `message.delivery.status`

Query delivery status for a message the calling account submitted through `message.send`; the device session identifies the account. Send the query to the relay that accepted the original request. Querying triggers neither delivery nor retries.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/message/delivery/status` |
| Session requirement | Device session |
| WSS | `message.delivery.status` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `message_id` | string | Yes | Message ID to query, only within the session account's scope |

### Successful Response

Returns [`DeliveryStatus`](../concepts/message-delivery.md#deliverystatus) with the latest known `status`.

### Error Response

If no result is found, return `not_found`, except where [Delivery result retention rules](../concepts/message-delivery.md#delivery-result-retention-rules) allow `message_expired`. Other errors follow [Common method conventions](conventions.md#error-codes).

## `message.timeline.sync`

Read, by sequence, the account timeline stored locally on the currently connected relay and visible to the current device. The device session identifies both account and device.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/message/timeline/sync` |
| Session requirement | Device session |
| WSS | `message.timeline.sync` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `after` | integer | No | Return only visible entries after this position; MUST be `-1` or a nonnegative safe integer and no greater than the account's [timeline head](../concepts/message-timeline.md#account-message-timeline) on this relay at read time; out-of-range returns `bad_request`. Defaults to `-1`, starting at the earliest retained device-visible record |
| `limit` | integer | No | Maximum entries for this page; MUST be a positive safe integer under [Pagination](conventions.md#pagination) |

A valid `after` need not correspond to an assigned, retained, or device-visible record. A value equal to the head returns an empty page.

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `items` | array&lt;[MessageTimelineEntry](../concepts/message-timeline.md#messagetimelineentry)&gt; | Yes | Earliest page of visible entries whose sequence exceeds the requested position, ascending by sequence; empty array if none |
| `certificates` | array&lt;DeviceCertificate&gt; | Yes | Sending-device certificates referenced by this page, deduplicated by derived device ID |
| `has_more` | boolean | Yes | Whether further visible entries exist at query time beyond this page; MUST be `false` for an empty page |
| `has_retention_gap` | boolean | No | Whether at least one record after the read position was originally visible to this device but has expired; MUST be `true` for a gap, otherwise omitted or `false` |

Clients MUST verify every certificate, derive device IDs, and confirm:

- Derived IDs are distinct.
- Their set covers all page references.
- Each certificate's account is the sending account of every record referencing it.

If multiple certificate versions exist for one device, the relay returns one with valid signatures. Clients use its stable public keys to verify historical messages, without retroactively judging authorization at relay acceptance from current certificate expiry. Certificate array order has no protocol semantics.

### Processing Rules

Select the earliest page of retained, device-visible entries with sequence greater than `after`, returning them ascending. Skip unassigned, invisible, or cleaned-up positions without consuming page entries; do not skip still-eligible records. An empty page MUST NOT be returned when eligible entries exist.

Determine `has_retention_gap` under [Message retention and history gaps](../concepts/message-timeline.md#message-retention-and-history-gaps); repeats from the same position may again return `true`. Even with gaps, return readable retained entries normally.

The next request's `after` uses the synchronization position determined by [Message timeline processing](../concepts/message-timeline.md#message-timeline-processing-flow).
