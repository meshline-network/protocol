# Message and Content Core Objects

[Client–relay protocol](../README.md) · [Core object index](README.md)

## Message ID

For every new message, the sender generates a 16-byte value, encodes it as unpadded base64url, and adds the `msg_` prefix. It MUST match `^msg_[A-Za-z0-9_-]{22}$` and is case-sensitive. Senders MUST ensure that new message IDs are unique within their account; a cryptographically secure random source is recommended.

## Message Envelopes and End-to-End Encryption

### Encrypted Message Envelopes

#### `MessageEnvelope`

`MessageEnvelope` is an immutable signed object for account messages. Client submission, inter-relay delivery, and account timelines share the same complete envelope for routing, queuing, deduplication, and signature verification.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.message.envelope` |
| `message_id` | string | Yes | [Message ID](#message-id) scoped to the sending account |
| `created_at` | integer | Yes | UTC Unix seconds when the sending device created and signed this envelope; source and destination relays independently validate it against their own clock tolerance and message delivery age limits |
| `from` | string | Yes | Sending [account ID](accounts-and-devices.md#account-id) |
| `from_device_id` | string | Yes | [Device ID](accounts-and-devices.md#device-id) derived from the sender's `DeviceCertificate` |
| `to` | string | Yes | Target [account ID](accounts-and-devices.md#account-id) |
| `payload` | EncryptedPayload | Yes | Encrypted complete JSON business object |
| `device_signature` | string | Yes | 64-byte Ed25519 signature by the device identified by `from_device_id` over this `MessageEnvelope` excluding this field, unpadded base64url |

The complete object's Canonical JSON UTF-8 encoding MUST NOT exceed 256 KiB (262,144 bytes). Signing input follows [Network-bound JSON inputs](../../general.md#network-bound-json-inputs).

Verifiers MUST complete certificate signature and identity-binding checks under [`DeviceCertificate`](accounts-and-devices.md#devicecertificate), confirming that its account and derived device ID match `from` and `from_device_id`, respectively.

`created_at` is the client's envelope creation time, used to determine whether delivery is still allowed. It does not order account timelines or determine timeline-record retention. For acceptance, retries, and expiry, see [Message delivery](../concepts/message-delivery.md).

A valid certificate signature does not establish current device authority. For current validity, see [`DeviceCertificate`](accounts-and-devices.md#devicecertificate); session-based request handling follows [Device session rules](../methods/authentication-and-sessions.md#session-validity-and-connection-binding) and the method's authorization requirements.

#### `EncryptedPayload`

`EncryptedPayload` is the ciphertext container for an encrypted message, encrypting one complete business object with a 32-byte message key. Account messages distribute their random content key through device key boxes; see [End-to-end encryption construction](#end-to-end-encryption-construction).

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `alg` | string | Yes | Authenticated encryption algorithm, fixed as `AES-256-GCM` |
| `nonce` | string | Yes | Random 12-byte nonce, unpadded base64url |
| `ciphertext` | string | Yes | Encrypted UTF-8 bytes of the complete business object serialized under [JSON](../../general.md#json-and-field-representations), followed by a 16-byte GCM authentication tag, encoded together as unpadded base64url |

Every new message's nonce MUST come from a cryptographically secure random source. The same key/nonce pair MUST NOT encrypt different inputs.

#### `MessageKeyBox`

`MessageKeyBox` wraps a message content key for one device of a specified account. The sender constructs it with the X25519 encryption public key in that device's certificate; the device holding the corresponding private key can unwrap it. Context binding follows [End-to-end encryption construction](#end-to-end-encryption-construction). Boxes MUST NOT be reused across messages, accounts, or devices.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `device_id` | string | Yes | [Device ID](accounts-and-devices.md#device-id) derived from the receiving device's `DeviceCertificate` |
| `alg` | string | Yes | Key-wrapping construction, fixed as `X25519-HKDF-SHA256-AES256GCM` |
| `enc` | string | Yes | Sender's ephemeral X25519 public key generated for this receiving device; 32 bytes, unpadded base64url |
| `sealed_key` | string | Yes | Message content key encrypted with this box's derived wrapping key; concatenate 12-byte nonce, 32-byte ciphertext, and 16-byte GCM tag in that order, then encode together as unpadded base64url |

Within one key-box set, `device_id` values MUST be distinct.

#### Recipient Message Key Boxes

The sender generates an array of `MessageKeyBox` objects for target-account devices and submits it as `recipient_boxes` in `message.send`. The array is nonempty, with at most 8 entries. Each box uses the target account specified by the envelope as the account allowed to decrypt.

The message's end-to-end semantics target an account; boxes are delivery material distributing the same content key to its devices. Each box's KDF and authenticated-encryption context follow [End-to-end encryption construction](#end-to-end-encryption-construction). Without the content key, a relay cannot construct valid boxes allowing other devices to decrypt the payload. Deleting or corrupting boxes can only prevent those devices from obtaining the message; it cannot reveal or change the body.

#### Sender Message Key Boxes

For non-self messages, clients may wrap the same content key for current sender-account devices and submit the resulting `MessageKeyBox` array as `sender_boxes` to the sender's current home relay. These let other sender-account devices recover the original content during bounded retention.

If present, sender boxes MUST form a nonempty array of at most 8 entries, with at least one device valid in the sender's current authoritative device state at acceptance. Some unavailable devices do not prevent acceptance of the entire message; they cannot read the sent record. Boxes need not cover all current devices. In self-delivery, sender and recipient accounts are identical and `recipient_boxes` already supplies the timeline record's own-account boxes, so sender boxes MUST be omitted.

Construct sender boxes under [End-to-end encryption construction](#end-to-end-encryption-construction). Original-message information in the context comes from the original envelope, and `account` is its sending account.

Sender boxes have no independent signature; the sending request's device session establishes their source. Clients verify and recover sent records under [Message timeline processing](../concepts/message-timeline.md#message-timeline-processing-flow).

### End-to-End Encryption Construction

#### Message Content Encryption

The sender generates a random 32-byte content key for each message. Invalidation of a box's device before delivery does not invalidate the payload or envelope signature.

Serialize the business object as UTF-8 bytes under [JSON](../../general.md#json-and-field-representations) and encrypt it with AES-256-GCM. Message AAD is the Canonical JSON UTF-8 bytes produced by the following object's [network-bound JSON input](../../general.md#network-bound-json-inputs):

```json
{
  "$type": "meshline.message.aad",
  "$context": "neo:860833102:0x...",
  "message_id": "msg_...",
  "created_at": 1750000000,
  "from": "neo:860833102:...",
  "from_device_id": "dev_...",
  "to": "neo:860833102:..."
}
```

`$type` is fixed as `meshline.message.aad` to distinguish message encryption AAD from other network-bound cryptographic inputs. Construct and validate `$context` from the trusted network context. Both recipient and sender independently reconstruct message AAD from the original envelope and trusted context, using those bytes as AES-GCM additional authenticated data. After obtaining the content key, decrypted plaintext may be used only after successful authentication.

#### Device Key Box Wrapping

Generate an ephemeral X25519 key pair for each receiving device and compute a shared secret with the encryption public key in its certificate. Both sender and recipient MUST reject all-zero results under [X25519 shared-secret validation](../../general.md#x25519-shared-secret-validation) before using the result in HKDF below. KDF info and key-box AAD use the same network-bound JSON input:

```json
{
  "$type": "meshline.message.key_box.aad",
  "$context": "neo:860833102:0x...",
  "alg": "X25519-HKDF-SHA256-AES256GCM",
  "payload_alg": "AES-256-GCM",
  "message_id": "msg_...",
  "created_at": 1750000000,
  "from": "neo:860833102:...",
  "from_device_id": "dev_...",
  "account": "neo:860833102:...",
  "device_id": "dev_...",
  "enc": "..."
}
```

| Parameter | Value or construction |
|---|---|
| KDF IKM | The X25519 shared secret computed above |
| KDF salt | `SHA-256(UTF8("Meshline/keybox-salt/v1"))` |
| KDF info | Canonical JSON UTF-8 bytes of the object above |
| Wrapping key | 32-byte HKDF-SHA-256 output |
| Key-box AAD | The same bytes as KDF info |
| `sealed_key` | Encrypt the content key with AES-256-GCM using the wrapping key, a random 12-byte nonce, and this key-box AAD; package the result in the format defined by [`MessageKeyBox`](#messagekeybox) |

`$type` is fixed as `meshline.message.key_box.aad`; construct and validate `$context` from the trusted network context. `account` is the account allowed to decrypt the box.

#### Random Sources and Recipient Validation

Random content keys, nonces, and ephemeral X25519 private keys MUST come from a cryptographically secure random source. Recipients MUST verify the envelope signature first, then unwrap the key box, then authenticate and decrypt the payload with message AAD reconstructed from the envelope and trusted context. If any check fails, no partial plaintext may be returned to the application.

## Plaintext Message Objects

### Business Objects Inside Envelopes

The encrypted plaintext of each `MessageEnvelope` is one complete JSON business object. Its root MUST contain a string `$type`; after decryption, receiving devices select object structure and validation rules by the complete string under [Object types](../../general.md#object-types).

The protocol defines these encrypted business objects:

| Business object `$type` | Object |
|---|---|
| `meshline.message.direct` | [`DirectMessage`](#directmessage) |
| `meshline.contact.consent` | [`ContactConsent`](../concepts/contacts.md#contactconsent) |
| `meshline.contact.grant` | [`ContactGrant`](../concepts/contacts.md#contactgrant) |
| `meshline.account.contacts.sync` | [`AccountContactSync`](../concepts/contacts.md#accountcontactsync) |
| `meshline.device.state.changed` | [`DeviceStateChanged`](#devicestatechanged) |
| `meshline.account.group.state.request` | [`AccountGroupPrivateStateRequest`](../groups/concepts/account-sync.md#accountgroupprivatestaterequest) |
| `meshline.account.group.state.sync` | [`AccountGroupPrivateStateSync`](../groups/concepts/account-sync.md#accountgroupprivatestatesync) |
| `meshline.account.group.history_secret.sync` | [`AccountGroupHistorySecretSync`](../groups/concepts/account-sync.md#accountgrouphistorysecretsync) |

Unknown `$type` objects may be saved as ordinary application messages, but recipients MUST NOT perform protocol state changes based on them.

Recipients MUST validate the complete structure, fixed `$type`, signatures, field bindings, and local-state preconditions under the object's section. The outer `MessageEnvelope` device signature does not replace signatures required by the business object itself. Relay verification of a delivery credential does not establish that ciphertext contains any particular business object; successful delivery MUST NOT be treated as proof of its validity.

Among business objects defined here, self-delivery permits only `DirectMessage` and these account synchronization objects: `AccountContactSync`, `AccountGroupPrivateStateRequest`, `AccountGroupPrivateStateSync`, and `AccountGroupHistorySecretSync`. Both sending and receiving accounts MUST be the local account, and recipients MUST reconfirm before execution that the sending device is still a current device of that account.

Self-delivery may also carry unknown `$type` objects. Recipients may save them as ordinary application messages or explicitly ignore them, but MUST NOT perform protocol state changes based on them. General checks, including envelope signature, same-account binding, and ciphertext authentication, still must pass.

`ContactConsent` follows bootstrap admission, declaration verification, and state transitions under [Establishing a contact relationship](../concepts/contacts.md#establishing-a-contact-relationship), without requiring a previously issued `ContactGrant` from recipient to sender. For direct messages and other contact-state objects arriving in cross-account messages, the recipient MUST confirm that it still locally retains an unexpired valid `ContactGrant` it issued to the envelope's sending account.

### `DirectMessage`

`DirectMessage` represents a direct chat message. The outer envelope determines sender and target accounts.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.message.direct` |
| `body` | [MessageBody](#messagebody) | No | Plain or formatted body; attachment references follow [hash reference rules](#attachment-references-in-bodies); omitted if no body |
| `attachments` | array&lt;ContentReference&gt; | No | [Media or file attachments](#attachment-handling-rules); empty or omitted if none |
| `reply_to` | DirectMessageReference | No | Direct message being replied to |

At least one of a body or a nonempty attachment array MUST be provided.

#### `DirectMessageReference`

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `from` | string | Yes | Sender account of the referenced message |
| `message_id` | string | Yes | Its message ID |

Clients locate the referenced message by `(from, message_id)`. To establish a reply relation, `from` MUST be one of the current conversation's two accounts; the referenced message MUST have been sent by it, belong to the same pair of accounts, and be a `DirectMessage`.

If field formats are valid but the account or an obtained referenced message fails these conditions, ignore the reply relation. If `from` is one of the conversation's accounts but the message is absent from local history, the unresolved relation may be retained. Neither case alone may cause rejection of the current message.

### `DeviceStateChanged`

`DeviceStateChanged` is a device-list cache invalidation notification sent to contacts through end-to-end encrypted messages. It carries no device delta and changes no account device state; it may be sent only after the current home relay accepts a new `AccountDeviceState`.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.device.state.changed` |
| `revision` | integer | Yes | Revision of the accepted `AccountDeviceState` triggering this notification; MUST be a nonnegative [safe integer](../../general.md#safe-integers-and-counter-advancement) |

The recipient first validates and decrypts under [Message timeline processing](../concepts/message-timeline.md#message-timeline-processing-flow), completes the contact-authorization checks in [Business objects inside envelopes](#business-objects-inside-envelopes), and confirms the outer sender is an existing contact. Within the same trusted network context and sender-account scope, it compares the notification `revision` with the complete device-state revision locally verified and saved. If the notification is no higher, the refresh hint may be ignored. If no such local state exists or the hint is higher, call [`device.state.resolve`](../methods/device-state.md#devicestateresolve), read and verify complete `AccountDeviceState`, and replace the prior view with its currently valid devices.

Automatic refreshes for one account MUST be rate-limited under [Notification handling rules](../notifications/README.md#notification-handling-rules). Pending hints may coalesce to their highest revision. They may be considered covered only once a verified read result has `revision` at least as high as the highest pending hint. A higher hint during the read, a failed read, or a still-lower result leaves refresh pending and requires catch-up. Notifications MUST NOT serve as device-validity evidence or directly advance locally verified revisions or change device permissions. Ignoring or merging hints MUST NOT clear other unsatisfied refresh requirements.

## Message Body

### `MessageBody`

`MessageBody` is shared by direct messages, channel posts, and group messages.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `content_type` | string | Yes | Body media type, optionally with format parameters; `charset` may be omitted, but if present MUST be `utf-8`, case-insensitively |
| `text` | string | Yes | Original text interpreted under the media type; MUST contain at least one non-[whitespace character](../../general.md#text-whitespace-characters); text is not base64-encoded |

`content_type` uses [media type syntax](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1); type, subtype, and parameter names are case-insensitive.

Standard Protocol 1.0 clients support these two bodies:

- `text/plain`: display as plain text, without interpreting Markdown or HTML.
- `text/markdown`: `variant=CommonMark` uses [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/); omitted `variant` also uses it. The variant value is case-insensitive.

For example, this Markdown body announces a new release:

```json
{
  "content_type": "text/markdown; variant=CommonMark",
  "text": "## Release announcement\n\nA **new version** was released today."
}
```

Clients MUST NOT execute scripts, event handlers, or other active content in bodies. Links MUST NOT execute unsafe URIs such as `javascript:`. An unknown format alone is not grounds to reject a message or block timeline synchronization.

### Attachment References in Bodies

Markdown bodies reference their message's or post's effective attachment set by the SHA-256 digest of attachment plaintext, using the `ni:` URI format in [RFC 6920 §3](https://www.rfc-editor.org/rfc/rfc6920.html#section-3).

Senders generate references from `ni:///sha-256;` followed by the base64url digest after `sha256:` in the attachment hash, ensuring each reference has a unique target in the message's or updated post's effective attachments. A body may reference one attachment multiple times; unreferenced attachments remain accessible through the attachment list.

For example, for `hash` equal to `sha256:Xj04LbTdg9WapXQnk61reQNAnoZcg7y8VINQSfBDvBU`, a body can use the following image and link:

```markdown
![On-site photo](ni:///sha-256;Xj04LbTdg9WapXQnk61reQNAnoZcg7y8VINQSfBDvBU)

[Open original image](ni:///sha-256;Xj04LbTdg9WapXQnk61reQNAnoZcg7y8VINQSfBDvBU)
```

Only link or image targets in the declared Markdown format form `ni:` attachment references. Fenced code, inline code, and escaped syntax create none. Plain text and unknown formats degraded to plain text do not interpret these references.

- Attachment references accept only absolute `ni:` URIs with empty authority, algorithm `sha-256`, and a complete 32-byte digest. Other algorithms, truncated digests, extra paths, queries, and fragments are forbidden.
- URI schemes are case-insensitive. Parse URI structure first, then percent-decode algorithm name and digest once each.
- The algorithm MUST be lowercase `sha-256`; the digest MUST be canonical unpadded base64url, with no case conversion or repeated decoding.
- Match against attachment `hash` by algorithm and decoded digest bytes.

Direct messages, group messages, and new posts match only their own attachment arrays; channel edits match effective attachments under the [editing rules](../channels/methods/timeline.md#channelpostedit-1). Missing targets MUST NOT be filled from other messages, posts, channels, groups, or global content caches.

Clients MUST NOT pass `ni:` references to browser or system URI handlers or perform network lookups from them. To download, use the matching attachment's `uri` and perform download, decryption, and integrity checks under [Attachment handling rules](#attachment-handling-rules).

For malformed references, missing targets, or temporarily unavailable attachments, clients retain the original body. They MUST NOT guess targets, fall back to external addresses, or prevent otherwise verified messages and events from completing synchronization. Reference and retrieval failures do not change signature or ciphertext validation results; invalid attachment fields or duplicate hashes still fail object validation.

## External Content References

External content requests may reveal IP addresses and access times to the host, and recipient-specific identifiers in URIs may track access. External content may also consume substantial bandwidth, storage, or decoding resources. End-to-end encryption and attachment digest verification do not hide these external-request details.

### `ContentReference`

`ContentReference` represents external content not directly embedded in a protocol object. It is not the content itself and does not establish long-term URI availability, ownership, or access rights.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `uri` | string | Yes | Absolute HTTPS URI for retrieving external content |
| `hash` | string | Yes | SHA-256 digest of the external content plaintext |
| `content_type` | string | Yes | Plaintext media type; MUST follow [media type syntax](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1); syntactically valid custom types are allowed |
| `size` | integer | Yes | Nonnegative plaintext byte length |
| `encryption` | ContentEncryption | No | External-content encryption parameters; omission means `uri` returns plaintext directly |

Both the initial request and every request after a redirect MUST use HTTPS. Before following a redirect, resolve its target to an absolute URI. If its scheme is not HTTPS, stop downloading and MUST NOT request that target.

A reference does not itself authorize its recipient to access the URI. Encryption keys are visible to anyone who can read `ContentReference`, so external content is confidential only when the protocol object containing the reference has appropriate confidentiality protection.

### `ContentEncryption`

`ContentEncryption` contains AES-256-GCM parameters for external content pointed to by `ContentReference`. It carries a random content key, not per-device key boxes. The recipient obtains the reference from a verified and, as needed, decrypted business object, then decrypts the external content with this key.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `alg` | string | Yes | Authenticated encryption algorithm, fixed as `AES-256-GCM` |
| `key` | string | Yes | 32-byte AES key independently generated for this content by a cryptographically secure random source, unpadded base64url |
| `nonce` | string | Yes | Independently generated 12-byte nonce for this content, never reused with the same key, unpadded base64url |

#### Encryption AAD Construction

The encryptor first computes `hash` and `size` from plaintext, then uses Canonical JSON UTF-8 bytes of this object as AES-GCM AAD:

```json
{
  "$type": "meshline.content.reference.aad",
  "alg": "AES-256-GCM",
  "hash": "sha256:...",
  "content_type": "image/png",
  "size": 12345
}
```

`$type` is fixed as `meshline.content.reference.aad`.

#### Ciphertext Format and Decryption Validation

Encrypted content returned by `uri` has the format `ciphertext || 16-byte GCM tag`; ciphertext length equals plaintext `size`. The recipient decrypts using `key`, `nonce`, and identical AAD. After GCM authentication, it MUST still check that plaintext length equals `size` and its SHA-256 digest equals `hash`. Failure of any check MUST reject the content.

### Attachment Handling Rules

Direct messages, channel posts, and group messages carry `ContentReference` entries in `attachments`; images, audio, and video are not embedded in `MessageBody`. Bodies and attachments both identify media types with `content_type`; attachment examples include `image/png`, `audio/ogg`, and `video/mp4`. Clients may preview or play by type; unsupported types or encodings may still be treated as ordinary files.

An object's attachment array MUST NOT contain duplicate `hash` values, even with different download addresses, media types, or encryption parameters. Hashes bind plaintext bytes, not storage locations or encryption choices, so reordering, changing download addresses, or re-encryption does not change body references. Finding a matching entry does not establish trusted content; downloaded content's `hash` and `size` still MUST be checked.

Senders reference attachments at external HTTPS locations through complete `ContentReference` objects in messages or posts. Confidential message attachments MUST be encrypted with independent random keys under [`ContentEncryption`](#contentencryption); message content keys, client group secrets, and group application secrets MUST NOT be used directly as attachment keys. Channel attachments are public and may be unencrypted. Even if encrypted, keys in public references are visible to every reader.

Recipients first verify the containing message or event and decrypt the message if needed, then retrieve attachments based on user action or local download policy. Before preview, playback, or application use, attachments MUST pass authenticated decryption when applicable, plaintext-length checks, and digest checks. URI suffixes or response media types MUST NOT be used to skip validation. Clients MUST NOT automatically execute scripts or other active content when receiving, downloading, or previewing attachments.

Download failure, cleaned-up content, or unavailable local preview support does not invalidate an already verified message or event. Clients may save the reference and attachment status and complete synchronization. Relay acceptance of a message or post does not require downloading external attachments first.
