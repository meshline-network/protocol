# Channel Management Methods

[Channel hosting protocol](../README.md) · [Common method conventions](../../methods/conventions.md) · [Business model](../concepts/model-and-timeline.md)

## Channel Descriptor Write Rules

For creation, update, and closure, the host uses the authenticated device session's certificate, confirms that its `account`, the calling account, and target descriptor's `creator` are identical and that it identifies the calling device, then validates the descriptor under [`ChannelDescriptor`](../core-objects.md#channeldescriptor). After acceptance, record outer `signer_device_id` and retain the certificate/descriptor association under [Device certificates for channel events](../core-objects.md#device-certificates-for-channel-events).

Creation, updates, and closure follow [Atomic commit and persistence rules](../concepts/model-and-timeline.md#atomic-commit-and-persistence-rules).

## `channel.create`

`channel.create` submits the complete signed initial descriptor to the connected relay, asking it to accept and host the channel.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/channel/create` |
| Session requirement | Device session |
| WSS | `channel.create` |
| HTTP success status | `204 No Content` |

### Request Parameters

Parameters are the complete client-signed [`ChannelDescriptor`](../core-objects.md#channeldescriptor) directly.

Creators MUST generate a new nonce and derive `channel_id` for each new channel under [Channel ID](../core-objects.md#channel-id). `creator` MUST match the session account; the session identifies the signer, and `relay_id` MUST be the currently connected relay.

Initial `revision` MUST be 0, `status` MUST be `active`, and `created_at` and `updated_at` MUST be identical client Unix seconds when signing the initial descriptor.

### Response Object

None. To retrieve creation and its `accepted_at`, call [`channel.read`](timeline.md#channelread).

### Processing and Errors

The relay confirms caller account and device through the session, verifies the complete descriptor signature with its certificate, and checks ID derivation, host, and initial-state constraints. Missing required fields, malformed fields, network fields reserved for signing input, or violations of ID, host, initial revision, status, or equal-time constraints return `bad_request`. Session and permission errors follow [Common errors](../../methods/conventions.md#error-codes); invalid certificate or descriptor signatures return `invalid_signature`.

The relay MUST check complete descriptor size under [`ChannelDescriptor`](../core-objects.md#channeldescriptor). Excess returns `request_too_large`, creating neither channel nor timeline entry.

Derived `channel_id` is the resource identity. If already hosted, return `state_conflict`.

Using local Unix seconds, the relay checks `created_at` against its clock tolerance. Too-old or too-future values return `clock_skew`, creating neither channel nor timeline entry.

After validation, write the complete request as the sequence-0 creation event, record `descriptor_rev` as 0, and fix its `accepted_at`. Establishing hosting state, saving current descriptor, and writing creation MUST be atomic.

Creation follows [Resource and security controls](../../methods/conventions.md#resource-and-security-controls).

## `channel.resolve`

`channel.resolve` queries the current or specified descriptor revision by channel ID.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/channel/resolve` |
| Session requirement | Device session |
| WSS | `channel.resolve` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `channel_id` | string | Yes | ID derived under [Channel ID](../core-objects.md#channel-id) |
| `revision` | integer | No | Exact requested revision, a nonnegative safe integer; omission means current revision |

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `descriptor` | ChannelDescriptor | Yes | Complete [descriptor](../core-objects.md#channeldescriptor) at the revision |
| `signer_certificate` | DeviceCertificate | Yes | Certificate signing that revision |

Clients MUST confirm channel ID and any specified revision match the request, validate certificate signatures and identity binding, then verify the descriptor with it. Validation and local updates follow [`ChannelDescriptor`](../core-objects.md#channeldescriptor).

### Processing and Errors

A supplied `revision` that is not a nonnegative safe integer returns `bad_request`. Missing channel, missing revision, or historical descriptor cleaned up under retention rules returns `not_found`. While `active`, current and retention/dependency-required historical descriptors MUST remain resolvable under [Timeline lifecycle](../concepts/model-and-timeline.md#channel-timeline-lifecycle).

## `channel.update`

`channel.update` submits a complete signed descriptor for the next revision to the host.

| Item | Convention |
|---|---|
| HTTP | `PUT /meshline/v1/channel/update` |
| Session requirement | Device session |
| WSS | `channel.update` |
| HTTP success status | `204 No Content` |

### Request Parameters

Parameters are the complete client-signed [`ChannelDescriptor`](../core-objects.md#channeldescriptor) directly.

`channel_id` identifies the target. Its `channel_id`, `nonce`, `creator`, `relay_id`, and `created_at` MUST equal current values, and `status` MUST remain `active`. The session account MUST still be the creator, and the valid calling device signs.

`revision` MUST be positive and exactly current revision plus 1; `updated_at` is client Unix seconds when signing this update.

Omitted optional fields are absent from the new descriptor; do not fill them from the old one.

### Response Object

None.

### Processing and Errors

Confirm account, device, and owner permission through the session, verify the complete signature using its certificate, and check ID derivation and state constraints. Missing or malformed fields, signing-input-only network fields, attempted immutable-field changes, or status other than `active` return `bad_request`. Session/permission errors follow [Common errors](../../methods/conventions.md#error-codes); invalid certificate or descriptor signatures return `invalid_signature`. New updates to a currently `closed` descriptor return `state_conflict`.

Check complete size under [`ChannelDescriptor`](../core-objects.md#channeldescriptor), returning `request_too_large` if exceeded. Check `updated_at` against local clock tolerance, returning `clock_skew` for excessively old or future times.

One channel revision can correspond to only one descriptor event. An occupied revision or one other than current plus 1 returns `state_conflict`.

At activation, current revision and state MUST still meet preconditions. Appending the verified complete request as a descriptor event, fixing `accepted_at`, advancing sequence, and saving current descriptor MUST be atomic. Saved descriptor and event `payload` MUST match the received signed object field for field. Validation or commit failure MUST NOT change channel state or timeline.

## `channel.close`

`channel.close` permanently closes a channel.

| Item | Convention |
|---|---|
| HTTP | `DELETE /meshline/v1/channel/close` |
| Session requirement | Device session |
| WSS | `channel.close` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `channel_id` | string | Yes | Channel to close |
| `revision` | integer | Yes | Signed final descriptor revision; MUST equal current revision plus 1 |
| `updated_at` | integer | Yes | Final descriptor's `updated_at`, with semantics from [`ChannelDescriptor`](../core-objects.md#channeldescriptor) |
| `device_signature` | string | Yes | Owner-account device's 64-byte Ed25519 signature over the final descriptor, unpadded base64url |

1. Copy the current descriptor, change `status` to `closed`, and set request `revision` and `updated_at`.
2. Remove root `device_signature`, preserving all other properties unchanged.
3. Sign under [`ChannelDescriptor`](../core-objects.md#channeldescriptor) rules and place the signature in the closure request.

### Response Object

None.

### Processing and Errors

An already closed channel or occupied target revision returns `state_conflict`.

At acceptance, current status MUST be `active`, target revision MUST be next, and the requesting device MUST be the owner's valid calling device. The relay MUST confirm account and device through the session, validate `updated_at` against its tolerance, reconstruct the final descriptor as above, and verify `device_signature`. Excessively old or future times return `clock_skew`. Failure MUST NOT change state or write the timeline.

Check the reconstructed complete final descriptor's size under [`ChannelDescriptor`](../core-objects.md#channeldescriptor), including inherited properties. Excess returns `request_too_large` without changes.

Appending the final descriptor, fixing `accepted_at`, advancing sequence, saving current descriptor, and closing MUST be atomic. Any failure MUST leave state and timeline unchanged.
