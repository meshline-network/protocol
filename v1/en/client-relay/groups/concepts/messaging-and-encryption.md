# Group Messaging and Encryption

[Group hosting protocol](../README.md) · [Group model and keys](model-and-keys.md)

## `GroupMessageEnvelope`

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.message` |
| `message_id` | string | Yes | [Message ID](../../core-objects/messages-and-content.md#message-id) scoped to the sending account |
| `group_id` | string | Yes | Target group; MUST match the call target, signing context, and final `GroupEvent`'s group |
| `epoch` | integer | Yes | Key epoch used for body encryption; included in key derivation context |
| `created_at` | integer | Yes | UTC Unix seconds when the device created and signed the envelope; included in message AAD |
| `payload` | [EncryptedPayload](../../core-objects/messages-and-content.md#encryptedpayload) | Yes | Encrypted complete business object |
| `device_signature` | string | Yes | Sender-device signature over the complete envelope excluding this field; synchronizing clients verify using the event-referenced certificate |

Submission and retries follow [`group.message.send`](../methods/messaging.md#groupmessagesend). Complete envelope Canonical JSON MUST NOT exceed 256 KiB.

## Group Message Key Derivation and Encryption

### Message AAD Construction

To encrypt or decrypt a group message, clients MUST construct `message_aad` below. It is not part of the envelope and is not transmitted with it; it binds the envelope, sender identity, and current network into key derivation and ciphertext verification.

Message fields come from the envelope. Determine sender account and device as follows:

- Senders use the account and device ID confirmed by the device session as `from` and `from_device_id`.
- Recipients first verify the [`group.sync`](../methods/lifecycle-and-sync.md#groupsync) page's `certificates`, then find the certificate for the event's operating device to determine `from_device_id` and `from`.

Both MUST generate the [network-bound JSON input](../../../general.md#network-bound-json-inputs) for:

```json
{
  "$type": "meshline.group.message.aad",
  "group_id": "grp_...",
  "epoch": 7,
  "message_id": "msg_...",
  "from": "neo:860833102:...",
  "from_device_id": "dev_...",
  "created_at": 1780000000
}
```

Call these bytes `message_aad_bytes`. Including account and device prevents identical message keys when different members or devices reuse a message ID.

### Message Key Derivation

Using `epoch_application_secret` for the message's epoch, derive a 32-byte key:

```text
message_key = HKDF-SHA-256(
  IKM  = epoch_application_secret,
  salt = SHA-256(UTF8("Meshline/group-message-salt/v1")),
  info = message_aad_bytes,
  L = 32
)
```

### Message Encryption and Decryption

Senders MUST serialize the complete business object under [JSON and field representation](../../../general.md#json-and-field-representations), encrypt its UTF-8 bytes with AES-256-GCM using `message_key`, `message_aad_bytes` as AAD, and a cryptographically secure random 12-byte nonce. Store the result as `payload`, with fixed `AES-256-GCM` algorithm, this random `nonce`, and ciphertext plus 16-byte tag. Nonce generation follows [`EncryptedPayload`](../../core-objects/messages-and-content.md#encryptedpayload).

Recipients verify the complete envelope signature, derive the key from the same context, take the nonce from `payload.nonce`, and authenticate using reconstructed AAD. After success, they MUST parse plaintext as a JSON business object and validate its structure by `$type` before processing. Content failing object validation MUST NOT be executed.

## Plaintext Group Message Objects

Every envelope encrypts a complete UTF-8 JSON business object whose root MUST contain string `$type`. After decryption, select structure and handling by the complete string:

| Business object `$type` | Object |
|---|---|
| `meshline.group.message.content` | [`GroupMessage`](#groupmessage), ordinary chat content |
| `meshline.group.member.nickname.update` | [`GroupMemberNicknameUpdate`](#groupmembernicknameupdate), sending member's nickname update |

Unknown types may be saved as unrecognized objects but MUST NOT change protocol state. The relay cannot decrypt them; envelope acceptance does not establish valid plaintext business content.

### `GroupMessage`

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.message.content` |
| `body` | [MessageBody](../../core-objects/messages-and-content.md#messagebody) | No | Plain or formatted body, with [hash references](../../core-objects/messages-and-content.md#attachment-references-in-bodies); omitted if none |
| `attachments` | array&lt;ContentReference&gt; | No | External content references; empty or omitted if none |
| `reply_to_seq` | integer | No | Referenced message's authoritative sequence; positive safe integer smaller than the current event sequence |

At least a body or a nonempty attachment array MUST be supplied. Attachments reuse [`ContentReference`](../../core-objects/messages-and-content.md#contentreference) and [Attachment handling](../../core-objects/messages-and-content.md#attachment-handling-rules). Complete references are encrypted with the body. External bytes at the URI do not count toward envelope size; reference objects do.

For a numerically valid `reply_to_seq`, a reply relation may be established only if it targets a message event in the same group whose content authenticates, decrypts, and is confirmed as `GroupMessage`. Administration, nickname, or other non-chat targets cause the relation to be ignored, not rejection of the current message solely for that reason.

A numerically valid target that is pruned, absent locally, or not yet decrypted due to missing keys may remain unresolved without rejecting the current message. If obtained and decrypted later, the checks above MUST be completed. Relays cannot decrypt `GroupMessage` and do not validate bodies, attachments, or reply relations.

### `GroupMemberNicknameUpdate`

`GroupMemberNicknameUpdate` uses [ordinary group messages](../methods/messaging.md#groupmessagesend) to set, change, or clear the sender's own group nickname:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.member.nickname.update` |
| `nickname` | string or null | Yes | A string replaces the local nickname; `null` clears the override |

#### Nickname and Sender Validation

Strings MUST contain a non-[whitespace character](../../../general.md#text-whitespace-characters) and be at most 256 UTF-8 bytes. Valid text, including leading/trailing whitespace, MUST be preserved without Unicode normalization.

Verified envelope, certificate, and AAD determine group and sender account; envelope device signing authenticates the sender.

Recipients MUST first verify envelope, certificate, historical member permission, and AEAD under [`group.sync`](../methods/lifecycle-and-sync.md#groupsync), then validate the nickname object and apply the rules below. Invalid business content MUST NOT change nickname state; it may be persisted as rejection and synchronization may continue. Relays do not return `bad_request` based on encrypted nickname content.

#### Local Nickname State

Clients maintain an independent optional nickname override per member per group, set or cleared by these updates. Display fallback does not write the nickname. Account-profile changes or renames in other groups do not alter it. Duplicate nicknames are allowed and MUST NOT determine identity or permissions.

Nicknames are local display state derived from messages each recipient can read, verify, and decrypt. Different members or same-account devices may display different values. The protocol provides neither snapshots nor inter-device nickname-state synchronization. Existing clients may retain overrides after relay message pruning.

Clients adopt only the greatest event `sequence` among valid nickname messages from one account, not arrival time, `created_at`, or decryption completion time. Delayed old decryption and already processed messages MUST NOT restore old values. Without keys, verified envelopes may be saved under ordinary message rules for later decryption; the same ordering check still applies afterward.

Role changes, ownership transfers, member key resets, and client-secret rotations preserve local nicknames. Departure, removal, or banning clears the member's override. Rejoining starts unset; unbanning restores no old nickname.
