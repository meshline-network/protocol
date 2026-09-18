# Message delivery methods

[Relay RPC protocol](../README.md) · [Common method conventions](conventions.md) · [Message delivery](../../client-relay/concepts/message-delivery.md)

## `message.deliver`

The source relay delivers to the target relay a message already accepted through `message.send`. The envelope's `to` is the recipient account and MUST differ from `from`; self-delivery within an account is handled directly by `message.send`.

### Request parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `envelope` | MessageEnvelope | Yes | The complete original envelope submitted by the client |
| `recipient_boxes` | array&lt;MessageKeyBox&gt; | Yes | The complete recipient key boxes submitted by the client, subject to the [recipient message key-box](../../client-relay/core-objects/messages-and-content.md#recipient-message-key-boxes) constraints |
| `signer_certificate` | DeviceCertificate | Yes | Certificate of the device that signed the envelope; MUST match the envelope's `from` and `from_device_id` |
| `authorization` | [ContactGrant](../../client-relay/concepts/contacts.md#contactgrant) or [ContactInvite](../../client-relay/concepts/contacts.md#contactinvite) | No | Authorization material from the original send request; MAY be omitted for public bootstrap delivery |

### Successful response

Returns [`DeliveryStatus`](../../client-relay/concepts/message-delivery.md#deliverystatus) with `status` set to `target_accepted`.

### Error response

If receipt is not accepted, the call fails without appending a receipt record. The main errors are listed below; other errors follow the [common error conventions](../../client-relay/methods/conventions.md#error-codes):

| Condition | Error code |
|---|---|
| A known valid current route points to another relay | `route_stale` |
| This relay cannot be confirmed as the recipient account's current home relay | `target_not_local` |
| The envelope creation time is beyond the local clock-skew tolerance in the future | `clock_skew` |
| This relay's message delivery deadline has passed | `message_expired` |
| All recipient devices are unavailable | `device_unknown` |

The source relay handles errors under [delivery deadlines and retries](../../client-relay/concepts/message-delivery.md#delivery-deadlines-and-retries) to decide whether to continue retrying or terminate delivery.

### Processing rules

Requests must pass basic parameter validation and relay-connection authentication. Previously accepted requests return their result under [idempotent message retries](../../client-relay/concepts/message-delivery.md#idempotent-message-retries); requests not yet accepted must satisfy the [receipt validation rules](../../client-relay/concepts/message-delivery.md#receiving-validation-rules).

After acceptance, the original envelope and recipient key boxes enter the recipient account's timeline, and synchronization responses must be able to provide the corresponding sender device certificate. Each message appends only one record. Device visibility follows the [account message timeline](../../client-relay/concepts/message-timeline.md#device-visibility).
