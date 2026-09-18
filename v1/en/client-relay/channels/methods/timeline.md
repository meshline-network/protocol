# Channel Timeline Methods

[Channel hosting protocol](../README.md) · [Core objects](../core-objects.md) · [Common method conventions](../../methods/conventions.md) · [Timeline semantics](../concepts/model-and-timeline.md#channel-timeline-lifecycle)

## Channel Content Write Rules

`channel.post`, `channel.post.edit`, and `channel.post.delete` use `ChannelPost`, `ChannelPostEdit`, and `ChannelPostDelete` directly as request parameters, respectively.

### Identity and Write Permissions

The host confirms caller account and device through the device session, verifies the business-object signature with that device's certificate, and confirms that object type matches the method.

Using the current descriptor at acceptance, it confirms that the account is owner or a moderator, recording that descriptor's revision as outer `descriptor_rev`. A descriptor change since client request construction is not alone grounds for rejection; if the caller remains authorized and other conditions hold, acceptance may use the newer revision.

The channel must be open for writing. Rejection of posting, editing, or deletion due to closure returns `state_conflict` under [Closed-state errors](../concepts/model-and-timeline.md#channel-timeline-lifecycle). Duplicate posting still follows [`channel.post`](#channelpost).

### Request Format and Content Validation

Complete request Canonical JSON UTF-8 encoding MUST NOT exceed 64 KiB (65,536 bytes). Signing excludes root `device_signature`, preserves all other known and unknown properties, and follows [Network-bound JSON inputs](../../../general.md#network-bound-json-inputs).

Post and edit bodies reuse [`MessageBody`](../../core-objects/messages-and-content.md#messagebody); images, audio, video, and other attachments reuse [`ContentReference`](../../core-objects/messages-and-content.md#contentreference) and [Attachment handling rules](../../core-objects/messages-and-content.md#attachment-handling-rules).

The relay MUST validate body and attachment-reference field structures, returning `bad_request` for violations. A syntactically valid but unsupported body media type MUST NOT be rejected solely for being unsupported.

Body references follow [Hash reference rules](../../core-objects/messages-and-content.md#attachment-references-in-bodies). Relays MUST check attachment `hash` format and uniqueness, returning `bad_request` otherwise; they need not parse Markdown to check reference targets.

### Event Persistence and Retention

Retention is calculated from event `accepted_at` and the applicable retention rules.

When writing a content event, the relay saves the complete request field for field as `payload`, including signature and unknown properties. It also records calling device and permission-check descriptor revision. Permissions MUST still hold at activation. Recording revision, appending event, fixing acceptance time, advancing head, and updating post state follow [Atomic commit and persistence rules](../concepts/model-and-timeline.md#atomic-commit-and-persistence-rules). Device certificate expiry or removal afterward does not retroactively invalidate administrative permission confirmed at acceptance. For deletion and cleanup, see [Timeline lifecycle](../concepts/model-and-timeline.md#channel-timeline-lifecycle).

## `channel.post`

`channel.post` creates a post in a public channel.

| Item | Convention |
|---|---|
| HTTP | `PUT /meshline/v1/channel/post` |
| Session requirement | Device session |
| WSS | `channel.post` |
| HTTP success status | `200 OK` |

### Request Parameters

Parameters are the complete signed `ChannelPost`, which becomes event `payload` unchanged after acceptance.

#### `ChannelPost`

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.channel.post` |
| `channel_id` | string | Yes | ID derived under [Channel ID](../core-objects.md#channel-id) |
| `message_id` | string | Yes | Publisher-generated [message ID](../../core-objects/messages-and-content.md#message-id); together with channel and publishing account, identifies the publication request during retention |
| `body` | [MessageBody](../../core-objects/messages-and-content.md#messagebody) | No | Plain or formatted body; omitted if none |
| `attachments` | array&lt;ContentReference&gt; | No | Media or file attachments; empty or omitted if none |
| `device_signature` | string | Yes | Publisher's calling device signature over complete `ChannelPost` excluding this field; 64-byte Ed25519, unpadded base64url |

A post MUST provide a body or at least one attachment, otherwise return `bad_request`.

The publishing account MUST generate a different message ID for every new post, even with body and attachments identical to an existing post.

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `sequence` | integer | Yes | Original post's timeline position; MUST be a positive safe integer |

Success means the service persisted the post as a new event's `payload`. Identical duplicate publication returns the original `sequence` without a new event.

### Processing and Errors

Validate under [Channel content write rules](#channel-content-write-rules).

During the original post's history retention, the same channel, publishing account, and message ID can correspond to only one `ChannelPost`. Compare complete-object [Canonical JSON](../../../general.md#canonical-json) for duplicates. Equality returns the original sequence without appending, advancing sequence, or notifying; differences return `state_conflict`. Even after deletion, its message ID MUST remain occupied at least until the [minimum deadline fixed at acceptance](../concepts/model-and-timeline.md#channel-timeline-lifecycle); later configuration changes cannot end this early.

After a lost response, clients may retry the complete unchanged post with the same ID and signature; the relay MUST return its original sequence without duplicate append. Clients MUST NOT automatically resend with a new ID solely because the post is not yet visible on the timeline, since that creates a new post.

## `channel.post.edit`

`channel.post.edit` appends a public edit event to an existing post.

| Item | Convention |
|---|---|
| HTTP | `PATCH /meshline/v1/channel/post/edit` |
| Session requirement | Device session |
| WSS | `channel.post.edit` |
| HTTP success status | `204 No Content` |

### Request Parameters

Parameters are the complete signed `ChannelPostEdit`. If it actually changes post state, it becomes event `payload` unchanged.

#### `ChannelPostEdit`

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.channel.post.edit` |
| `channel_id` | string | Yes | Channel containing the target post |
| `target_sequence` | integer | Yes | Target's sequence in this channel; positive safe integer referencing an existing, undeleted `ChannelPost` |
| `body` | MessageBody or null | No | Omission preserves current body; explicit `null` removes it; an object completely replaces it with the supplied [body](../../core-objects/messages-and-content.md#messagebody) |
| `attachments` | array&lt;ContentReference&gt; or null | No | Omission preserves current attachments; `null` removes the field; an array completely replaces the set |
| `device_signature` | string | Yes | Editor's calling device signature over complete `ChannelPostEdit` excluding this field; 64-byte Ed25519, unpadded base64url |

Body, attachments, and unknown root edit properties independently follow the same patch rules: omission preserves, `null` deletes, other values add or completely replace. Objects and arrays replace entirely without recursive merging. An edit MUST supply body, attachments, or at least one mappable unknown property. The updated post MUST retain a body or at least one attachment; otherwise return `bad_request`.

State used for updates and comparison consists of body, attachments, and unknown post-root properties, initialized from the original post and then edited in timeline order.

Edit `$type`, `channel_id`, `target_sequence`, and `device_signature` are not merged into post state. Unknown properties MUST NOT reuse defined `ChannelPost` field names; other restrictions follow [Field mapping](../../../general.md#field-mapping). Violations return `bad_request`. All unknown edit properties still participate in signing and remain unchanged when an event is produced.

When deleting an attachment still referenced by the body, senders should also remove or change its references. Clients resolve hashes against effective attachments after this edit. Omission may reference retained attachments; after explicit replacement or clearing, missing targets MUST NOT be filled from earlier sets.

### Response Object

None.

Changed state adds the edit as a new public timeline event's payload. Unchanged state also succeeds but creates no event.

### Processing and Errors

Validate under [Channel content write rules](#channel-content-write-rules).

`target_sequence` MUST reference an existing post in the same channel. Invalid format/range or an existing non-post event returns `bad_request`; missing position or cleaned-up state returns `not_found`; a retained deleted-target state returns `state_conflict`. Rejection MUST NOT append events. Permission does not depend on authorship.

Determine change by comparing before/after state [Canonical JSON](../../../general.md#canonical-json) at activation. Identical UTF-8 bytes mean success without append, sequence advancement, or notification. Otherwise append the complete edit and update post state, without rewriting the original or prior edits.

Append and state update MUST be atomic. Concurrent edits follow actual accepted-and-committed timeline order. Clients first verify original event signatures, then compute current post state including unknown properties in that order.

## `channel.post.delete`

`channel.post.delete` appends a public deletion event for an existing post.

| Item | Convention |
|---|---|
| HTTP | `DELETE /meshline/v1/channel/post/delete` |
| Session requirement | Device session |
| WSS | `channel.post.delete` |
| HTTP success status | `204 No Content` |

### Request Parameters

Parameters are the complete signed `ChannelPostDelete`, becoming event `payload` unchanged after successful deletion.

#### `ChannelPostDelete`

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.channel.post.delete` |
| `channel_id` | string | Yes | Channel containing the target |
| `target_sequence` | integer | Yes | Target post's sequence in the same channel; positive safe integer referencing an existing undeleted `ChannelPost` |
| `reason` | string | No | Public explanation for readers; if present, MUST include at least one non-[whitespace character](../../../general.md#text-whitespace-characters) |
| `device_signature` | string | Yes | Initiator's calling device signature over complete `ChannelPostDelete` excluding this field; 64-byte Ed25519, unpadded base64url |

`reason` does not affect permission or state decisions; if present, it is signed business-object content.

### Response Object

None.

Success means the deletion object entered the public timeline as new event payload, and the target and existing edits have stopped returning.

### Processing and Errors

Validate under [Channel content write rules](#channel-content-write-rules).

Empty/whitespace-only `reason`, invalid target format/range, or an existing non-post target returns `bad_request`; missing position or cleaned-up state returns `not_found`; retained deleted state returns `state_conflict`. Permission does not depend on authorship.

Appending the complete deletion and stopping `channel.read` from returning the target and all preceding edits to it MUST be atomic. Any failure MUST leave state and timeline unchanged. Their sequences remain gaps and MUST NOT be reassigned. Later deletion attempts use the target-state errors above and MUST NOT create another deletion event.

## `channel.post.report`

`channel.post.report` lets the calling account report a post to the host through its current device. A report is not a channel event and never enters the public timeline. It does not itself authorize hiding, deletion, or restriction of the post.

| Item | Convention |
|---|---|
| HTTP | `PUT /meshline/v1/channel/post/report` |
| Session requirement | Device session |
| WSS | `channel.post.report` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `channel_id` | string | Yes | ID derived under [Channel ID](../core-objects.md#channel-id), hosted by the connected relay |
| `target_sequence` | integer | Yes | Reported post's sequence in this channel; positive safe integer referencing an undeleted post |
| `reason` | string | Yes | Report reason containing at least one non-[whitespace character](../../../general.md#text-whitespace-characters) |

### Response Object

None.

Success means the report is persisted, not that action has been taken.

### Processing and Errors

Retain only one current report per account per channel post. A repeat completely replaces it with this request's reason, calling device, and local acceptance time.

An empty, whitespace-only, or locally over-length reason, invalid target format/range, or existing non-post target returns `bad_request`; missing position or cleaned-up state returns `not_found`; retained deleted state returns `state_conflict`. Rejection MUST NOT create or replace a report.

## `channel.read`

`channel.read` reads the latest page, pages backward through existing history, or synchronizes forward from a client's completed position to later events still readable.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/channel/read` |
| Session requirement | Device session |
| WSS | `channel.read` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `channel_id` | string | Yes | ID to read, derived under [Channel ID](../core-objects.md#channel-id) |
| `before` | integer | No | Return existing records strictly below this sequence; nonnegative safe integer |
| `after` | integer | No | Return existing records strictly above this sequence; `-1` starts from creation, otherwise a nonnegative safe integer |
| `limit` | integer | No | Maximum entries for the page; positive safe integer under [Pagination](../../methods/conventions.md#pagination) |

Handle boundary combinations as follows:

| Boundary combination | Behavior |
|---|---|
| Both omitted | Read the latest page as of query start |
| Only `before` | Page backward through older history |
| Only `after` | Synchronize forward to newer events |
| Both present | Return `bad_request` |

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `events` | array&lt;[ChannelEvent](../core-objects.md#channelevent)&gt; | Yes | Still-readable events in strictly ascending sequence order; deleted posts and existing edits, and edits whose originals are unavailable, MUST be absent; empty if none eligible |
| `certificates` | array&lt;DeviceCertificate&gt; | Yes | Certificates referenced by page event `signer_device_id`, deduplicated by derived device ID |
| `has_more` | boolean | Yes | Whether more returnable events exist in this reading direction: older than the first item for latest/`before`, or newer than the last for `after` |

A response with `has_more: true` MUST contain at least one event.

Clients validate certificates and references under [Device certificates for channel events](../core-objects.md#device-certificates-for-channel-events), verify known-object signatures with referenced certificates, and determine operating accounts from them.

### Processing and Errors

#### Read Modes and Boundaries

With both boundaries omitted, the relay MUST fix a snapshot boundary at query start and select the latest readable events no later than it. To continue backward, use the first sequence as `before`; to read later new events, use the last as `after`. New appends have larger sequences and do not change existing historical page boundaries.

With `before`, return only readable earlier records. The boundary need not identify a readable record. A value above the current head yields the same latest page as omitting both boundaries; 0 returns an empty array with `has_more: false`.

With `after`, start at the earliest readable event above it and move forward. Continue using the last sequence on the page. A boundary above the current head returns `bad_request`. The boundary itself need not identify an assigned or readable record; skip unassigned, deleted, or cleaned-up positions. Nonconsecutive sequences do not mean synchronization failure or independently prove deletion of a local record.

Boundaries constrain only the returned range; they do not assert that the client has read, verified, or processed the boundary or earlier events.

#### Client Validation and Application

Before adopting an event, clients MUST verify it under [ChannelEvent](../core-objects.md#channelevent) and [Device certificates for channel events](../core-objects.md#device-certificates-for-channel-events). Descriptor validation and current-state updates follow [`ChannelDescriptor`](../core-objects.md#channeldescriptor). Required descriptors may come from cache, this page's descriptor events, or [`channel.resolve`](channel-management.md#channelresolve) by exact revision; fetch missing revisions as needed. Missing or invalid descriptors MUST prevent adoption of dependent content events.

Content events MUST use a verified descriptor for the same channel with `revision` equal to `descriptor_rev`, confirming permission under [Timeline lifecycle](../concepts/model-and-timeline.md#channel-timeline-lifecycle). Deletions may reference posts no longer returned. When applying valid `ChannelPostDelete`, clients MUST remove the target and all preceding edits to it locally; an absent local target is treated as already deleted.
