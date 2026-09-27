# Account Message Timeline

[Client–relay protocol](../README.md) · [Message delivery](message-delivery.md) · [Message methods](../methods/messaging.md)

## Timeline Model

An account uses a single append-only message timeline on each relay; timelines on different relays are independent. The current home relay appends the following records to that account's local timeline:

- Every `MessageEnvelope` received by the account.
- Messages sent by the account through `message.send` with `sender_boxes` supplied.

Each record stores the original envelope and key boxes for the account that owns the timeline.

The relay assigns nonnegative `sequence` values to the account message timeline and permanently retains the highest sequence ever assigned to that account on this relay. Every subsequent sequence MUST be greater than that value; continuity is not required. Message cleanup and relay restarts MUST NOT reduce or reset the highest sequence. The timeline head is this highest sequence, or `-1` if none has ever been assigned.

A sequence denotes a record position for an account on this relay and is not compared across accounts or relays. History-gap positions are likewise scoped to the account's timeline on the corresponding relay.

The timeline provides cross-device synchronization within the retention period, not permanent chat storage. Messages and protocol state persisted by clients are the long-term record.

Across all relays, clients deduplicate by the envelope's `(from, message_id)`. The first accepted message MUST pass validation. Subsequent records with the same logical message key MUST be ignored; they MUST NOT overwrite accepted content or be applied again.

## `MessageTimelineEntry`

`MessageTimelineEntry` is a visible record in a synchronization response.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `sequence` | integer | Yes | Position in the account timeline; nonnegative and strictly increasing |
| `envelope` | MessageEnvelope | Yes | The original message envelope accepted by the relay |
| `key_box` | MessageKeyBox | Yes | Key box wrapping the original message content key for the current device |
| `accepted_at` | integer | Yes | Unix seconds when the relay accepted this record |

The timeline's account MUST be the original envelope's sender or recipient account. When these accounts differ, the client determines direction from the sender and target accounts in the record's envelope; when they are identical, this is account self-delivery.

## Device Visibility

An inbound `MessageEnvelope` occupies only one sequence in the target account's timeline. The relay determines device visibility when accepting the record: devices in that account's key boxes that are valid at that time are allowed to synchronize the item. Unknown devices and devices not yet effective, removed, expired, or revoked cannot read it.

If at least one target device is valid, the relay accepts the entire message and provides synchronization for that scope. If all target devices are unavailable, the entire delivery fails and no timeline entry is appended.

Sent records are visible only to devices in the account's key boxes that were valid at acceptance.

If the same device ID is removed and later re-enabled, existing records retain their device visibility, and history-gap determination does not reset.

Sequence gaps may result from unassigned numbers or records invisible to the device. Numeric gaps alone MUST NOT be treated as lost history; determine history gaps under [Message retention and history gaps](#message-retention-and-history-gaps).

## Message Retention and History Gaps

Each record's minimum retention deadline is `accepted_at` plus the `message_retention` configured when the relay accepted it. Later configuration changes MUST NOT shorten that period. Current configuration is returned in the `limits` of [`relay.info`](../methods/relay-information.md#relayinfo). For delivery-result retention, see [Delivery result retention rules](message-delivery.md#delivery-result-retention-rules).

After cleaning up expired records, the relay MUST still correctly determine history gaps from device visibility and the requested position. If at least one record after the requested position was originally visible to the device but its complete content has expired, the synchronization response MUST contain `has_retention_gap: true`. Records not addressed to the current device, or whose corresponding device was unavailable at acceptance, do not form a history gap for that device.

## Message Timeline Processing Flow

The client MUST validate this page's `certificates` array under the response constraints of [`message.timeline.sync`](../methods/messaging.md#messagetimelinesync), and validate each record's envelope under [`MessageEnvelope`](../core-objects/messages-and-content.md#messageenvelope). It then confirms that `key_box.device_id` matches the current device ID and uses that `key_box` to unwrap the content key and authenticate and decrypt the payload under [End-to-end encryption construction](../core-objects/messages-and-content.md#end-to-end-encryption-construction).

Before applying business content from other accounts, clients MUST additionally validate the sender relationship or the authorization material carried by the business object itself. Records sent to other accounts MUST confirm that the sender is the local account. Account self-delivery MUST confirm that both envelope endpoints are the local account.

State changes within each business domain MUST take effect in the corresponding relay's sequence order. Unknown business `$type` values MAY be saved or ignored; invalid business content or content that fails authorization validation MUST NOT be applied.

The synchronization position is scoped to an account and relay and is supplied as the `after` parameter of [`message.timeline.sync`](../methods/messaging.md#messagetimelinesync). After validating a response, clients MAY continue synchronization using the largest sequence in that page; before synchronization begins, use `-1` or omit `after`. Empty pages do not change the synchronization position.
