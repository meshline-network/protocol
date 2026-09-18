# Channel Hosting Protocol

[Client–relay protocol](../README.md)

Channel hosting is an optional client–relay module. Clients connect directly to the hosting relay; operations use neither the account route DHT nor relay RPC. A relay offering channel hosting MUST implement this entire module and declare `channel.host.v1` in a valid `RelayDescriptor`.

The creator account establishes a channel and automatically becomes its owner. The owner signs subsequent descriptor revisions; owner and moderators may maintain the public timeline. Clients with valid device sessions may resolve and read channels. The hosting relay verifies permissions and adds descriptor, post, edit, and deletion events to one timeline in acceptance order. Closing permanently stops writes to both descriptor and timeline.

## Protocol Contents

| Section | Contents |
|---|---|
| [Model and timeline](concepts/model-and-timeline.md) | Fixed hosting, permissions, descriptor revisions, unified timeline, post deletion, and bounded retention |
| [Core objects](core-objects.md) | Channel ID, `ChannelDescriptor`, and `ChannelEvent` |
| [Channel management methods](methods/channel-management.md) | Creation, queries, updates, and closure |
| [Timeline methods](methods/timeline.md) | Posting, editing, deletion, reporting, reading, and synchronization |
| [Subscription methods](methods/subscription.md) | Subscription-set replacement, limits, and failures |
| [Channel notifications](notifications/README.md) | Timeline change notifications |

## Method Index

All methods below use device sessions.

| Method | HTTP | WebSocket |
|---|---|---|
| [`channel.create`](methods/channel-management.md#channelcreate) | POST | JSON-RPC |
| [`channel.resolve`](methods/channel-management.md#channelresolve) | GET | JSON-RPC |
| [`channel.update`](methods/channel-management.md#channelupdate) | PUT | JSON-RPC |
| [`channel.close`](methods/channel-management.md#channelclose) | DELETE | JSON-RPC |
| [`channel.post`](methods/timeline.md#channelpost) | PUT | JSON-RPC |
| [`channel.post.edit`](methods/timeline.md#channelpostedit) | PATCH | JSON-RPC |
| [`channel.post.delete`](methods/timeline.md#channelpostdelete) | DELETE | JSON-RPC |
| [`channel.post.report`](methods/timeline.md#channelpostreport) | PUT | JSON-RPC |
| [`channel.read`](methods/timeline.md#channelread) | GET | JSON-RPC |
| [`channel.subscribe`](methods/subscription.md#channelsubscribe) | N/A | JSON-RPC |

HTTP/WSS mapping and errors follow [Client–relay method conventions](../methods/conventions.md).

## Notification Index

- [`channel.timeline.changed`](notifications/README.md#channeltimelinechanged)

Envelopes follow [Client–relay notification conventions](../notifications/README.md).

## Conformance Requirements

Conforming implementations MUST follow [Conformance testing boundaries](../../test-vectors/README.md#conformance-testing-boundaries) and [Common client method conventions](../methods/conventions.md), covering:

- Descriptors and lifecycle: verify ID derivation, complete descriptor signing and replacement, field and total-size limits, consecutive revisions, query confirmation after conflicts, current-descriptor rollback prevention, and terminal closure under [Core objects](core-objects.md) and [Channel management methods](methods/channel-management.md).
- Content writes: verify owner/moderator permissions, complete request and certificate binding, post idempotency, omission versus deletion in edits, successive-edit reconstruction, deletion/reporting conflicts, and signature protection and safe handling of bodies and attachments under [Timeline methods](methods/timeline.md).
- Commit and retention: verify concurrent permission/state checks, failure recovery, stable acceptance times and sequences, retention configuration changes, and retention dependencies of edits and verification material under [Timeline lifecycle](concepts/model-and-timeline.md#channel-timeline-lifecycle) and [Atomic commit rules](concepts/model-and-timeline.md#atomic-commit-and-persistence-rules).
- Reading and reconstruction: verify latest, forward, and backward pages, nonconsecutive positions, page ordering, `has_more`, historical descriptor/certificate validation, and readable scope after deletion or cleanup under [`channel.read`](methods/timeline.md#channelread).
- Subscriptions and notifications: verify atomic set replacement, clearing, reduced limits, failure details and preservation of the original set, notification coalescing, and catch-up under [Subscription methods](methods/subscription.md) and [Channel notifications](notifications/README.md). Notifications MUST NOT directly advance synchronization positions.
