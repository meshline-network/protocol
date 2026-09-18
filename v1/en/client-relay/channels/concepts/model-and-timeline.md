# Channel Model and Timeline

[Channel hosting protocol](../README.md) · [Channel core objects](../core-objects.md)

A channel is hosted by the relay designated by its creator; no migration flow is defined. Successful creation automatically makes the creator account owner. The owner manages descriptor updates and closure; owner and moderators may publish, edit, and delete public content. Descriptors use consecutive revisions. Descriptor updates, posts, edits, and deletions enter one public timeline in hosting-relay acceptance order.

## Channel Timeline Lifecycle

### Event Writes

On creation, the hosting relay stores the initial `ChannelDescriptor` as the creation event at sequence 0. Each subsequent accepted descriptor update, post, edit, or deletion receives a sequence greater than the current head and enters the timeline with its complete accepted descriptor or content object as `payload`.

Each entry also records acceptance time `accepted_at` and corresponding `descriptor_rev`. Descriptor events use their own revision; content events use the descriptor revision effective at acceptance. Creation has revision 0.

Sequences express acceptance order within a channel. Duplicate publications, edits leaving post state unchanged, failed requests, reports, and reads create no events.

Writes follow [Atomic commit and persistence rules](#atomic-commit-and-persistence-rules). Assigned sequences MUST NOT be reassigned to other events; cleanup MUST NOT renumber retained events.

### Post Editing

A post event establishes the message ID and initial state, including body, attachments, and unknown properties. Duplicate recognition follows [`channel.post`](../methods/timeline.md#channelpost). Edits do not modify or replace original posts; clients apply verified edits by relay-assigned sequence. Edits may update body, attachments, and unknown properties. Whether an event is produced follows state comparison under [Post editing](../methods/timeline.md#channelpostedit). For body and attachment structure, see [Channel content write rules](../methods/timeline.md#channel-content-write-rules). Edit permission does not depend on the target post's author.

A single edit is not complete post state. Reconstruction at a point in time requires the corresponding post and edit events.

### Post Deletion

A deletion event is terminal for the target post. Appending it and stopping `channel.read` from returning the target `ChannelPost` and all preceding `ChannelPostEdit` events targeting it MUST take effect atomically. Deletion permission does not depend on the author.

After obtaining and applying deletion, conforming clients MUST remove the post and its existing edits from their local channel timeline. New clients no longer obtain their bodies from the hosting relay.

Deletion controls subsequent relay-provided timelines and conforming-client behavior, not guaranteed remote erasure. The protocol cannot ensure that clients holding old posts continue synchronizing or perform deletion, or retract separately saved or forwarded copies.

### Channel Closure

The `ChannelDescriptor` produced by `channel.close` is the final write. No new descriptor update, post, edit, or deletion may be accepted afterward, and closed state cannot be reversed.

Rejections of `channel.update`, `channel.close`, `channel.post`, `channel.post.edit`, or `channel.post.delete` because the channel is closed all return [`state_conflict`](../../methods/conventions.md#error-codes). Invalid parameter formats still use `bad_request`. Duplicate recognition follows each method; rejection MUST NOT change state or timeline.

### Event Retention and Cleanup

While a channel is `active`, event retention and cleanup follow these rules.

Each event's minimum deadline is its `accepted_at` plus `channel_timeline_retention` declared by `relay.info` at acceptance. Except for content cleanup below, the host MUST retain it at least through that deadline. Later changes MUST NOT shorten it. Creation, descriptor updates, posts, edits, and deletions share this rule.

While an original post remains readable through `channel.read`, all edits targeting it MUST remain retained and obtainable under timeline reading rules, even after an edit's own minimum retention expires. This dependency does not extend the original post's minimum retention. Once deletion or cleanup stops returning the post, its edits also stop returning.

After successful deletion, the relay may immediately clean up the post and its existing edits without waiting for their individual minimum deadlines. After retention-based cleanup of the original post, it may likewise immediately clean up edits without waiting for theirs.

A deletion event MUST remain retained and readable at least until the later of its own and the original post's minimum deadlines. A client resuming after deletion-event cleanup may never learn its cached post was deleted.

Reads, duplicate publications, subscription state, and stopping post returns after deletion MUST NOT refresh acceptance times or original deadlines. After a post stops returning, the relay MUST still retain its publishing-account/message-ID binding, original `sequence`, and information needed for duplicate-content comparison at least through the original post's minimum deadline. Cleanup or later configuration reduction cannot remove this early.

Cleanup MUST NOT change the timeline head, rewrite other events, or reuse sequences. An edit's target is unavailable once its original post is cleaned up or no longer returned.

Device certificates and complete descriptors at the relevant revisions needed to verify these edits and deletions MUST remain retained with the events and available under their read rules.

### Descriptor Retention and Permission Verification

The initial timeline `ChannelDescriptor` represents creation; subsequent ones represent updates. While `active`, the latest descriptor MUST remain as current channel state. Historical descriptors required by the timeline MUST remain complete, with signer references and certificates for both current and required historical descriptors. All these descriptors and their signer certificates MUST be retrievable through `channel.resolve`. While current-state or dependency requirements persist, event cleanup MUST NOT delete the required descriptor or certificate.

To verify content events, clients retrieve and verify the complete [`ChannelDescriptor`](../core-objects.md#channeldescriptor) named by outer `descriptor_rev`, confirming the operation's signing account equals `creator` or appears in `moderators`. Verified descriptors and certificates may be cached and reused by revision. Event structure, certificate references, and signature verification follow [ChannelEvent](../core-objects.md#channelevent) and [Device certificates for channel events](../core-objects.md#device-certificates-for-channel-events).

## Atomic Commit and Persistence Rules

Creation, updates, closure, posting, editing, and deletion MUST atomically activate a complete consistent result comprising required hosting state, current descriptor, post state, complete event and verification material, descriptor revision, `accepted_at`, and sequence. At activation, permission, current revision, channel state, target-post state, and other preconditions MUST still hold. Content permission checks and revision recording MUST use the same current descriptor. Failure MUST NOT leave partial business effects or advance the head.

Before success or notification, the relay MUST persist everything required for the operation. Activated results must remain complete and consistent after restart or recovery. Notification failure does not roll back channel state or timeline.

## Trust and Resource Boundaries

Clients MUST verify host identity and `channel.host.v1` through the Registry and current `RelayDescriptor`, and use valid device sessions. Timeline sequence is the relay's claim of acceptance order; `accepted_at` claims acceptance time; content `descriptor_rev` claims the effective descriptor revision at acceptance.

Creation, writing, reporting, and subscription limits follow [Resource and security controls](../../methods/conventions.md#resource-and-security-controls). Invalid signatures, insufficient permissions, and revision rollback MUST NOT change verified state.
