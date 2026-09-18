# Group Message Methods

[Group hosting protocol](../README.md) · [Group model and keys](../concepts/model-and-keys.md) · [Common method conventions](conventions.md)

## `group.message.send`

Current unbanned members send new messages with the current epoch's application secret. Previously accepted requests retry under the idempotency rules below.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/group/message/send` |
| Session requirement | Device session |
| WSS | `group.message.send` |
| HTTP success status | `200 OK` |

### Request Parameters

Parameters are [`GroupMessageEnvelope`](../concepts/messaging-and-encryption.md#groupmessageenvelope), encrypting a [group business object](../concepts/messaging-and-encryption.md#plaintext-group-message-objects). The device session identifies sender account and device.

Within one network and hosting relay, duplicates use `(sending account, message_id)`; see [Idempotent group message retries](#idempotent-group-message-retries).

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `sequence` | integer | Yes | Assigned message event position, a positive safe integer; may establish `reply_to_seq` references and local deduplication, but MUST NOT advance [`group.sync`](lifecycle-and-sync.md#groupsync) position |

### Processing and Errors

New requests MUST validate complete size, client time, current membership, writable group status, current envelope `epoch`, and sender signature/session consistency.

Invalid envelope format, identifiers, ciphertext structure, or time-field type/representation returns `bad_request`; `created_at` outside clock tolerance returns `clock_skew`; complete request/envelope size excess returns `request_too_large`; missing group returns `not_found`; nonmember or banned account returns `forbidden`; closure, noncurrent epoch, or concurrent write conflict returns `state_conflict`.

Acceptance MUST atomically allocate a strictly increasing sequence, append the original envelope as message-event `payload`, save the sender certificate, and update minimum retention for current key material. Messages do not advance epoch. After persistence, send `group.timeline.changed`.

The relay cannot decrypt and therefore cannot reject an envelope based on business-object contents. Recipient validation, waiting for keys, and rejection follow [`group.sync`](lifecycle-and-sync.md#groupsync).

### Idempotent Group Message Retries

Every call still checks parameters, size, device session, sender signature/session binding, hosting, and current sending permissions. The group MUST still exist actively, the caller MUST remain a current unbanned member, and its device MUST retain permission. Closure returns `state_conflict`; invalid sessions and insufficient current authority follow this method. Historical acceptance cannot bypass authorization.

During idempotency retention, the same logical key follows these rules:

- Identical complete-envelope [Canonical JSON](../../../general.md#canonical-json) returns the original sequence. Comparison includes signatures, unknown properties, and optional-field presence.
- A different complete envelope returns `state_conflict` without overwriting original content or result.
- Identical requests create no event, sequence, or notification, extend neither message nor key retention, and alter no sender device, acceptance time, or other event data.
- An identical accepted request is not rechecked against `created_at` tolerance or current epoch; elapsed time and rotation do not negate acceptance. Concurrency, lost responses, and restart do not change these rules.

While the group exists, the relay MUST retain comparison information and original sequence at least through original `accepted_at` plus `group_message_retention` at acceptance, matching minimum message retention. Later configuration changes and repeated requests MUST NOT shorten or extend that fixed minimum.

After retention, original results are no longer guaranteed available. If still returned, identical-content and original-sequence rules continue to apply.

Timeout, disconnection, or response loss does not prove nonacceptance. Clients should retry unchanged at the original host, not switch message IDs merely because the result is unknown.

Explicitly rejected, unaccepted messages may be corrected and resent according to the reason. Re-encryption from an old epoch MUST use a new message ID.
