# Group Hosting Protocol

[Client–relay protocol](../README.md)

Group hosting is an optional client–relay module. Users create groups and select a fixed hosting relay; clients connect directly to it, without account route DHT or relay RPC. Relays offering this capability MUST implement the entire module and declare `group.host.v1` in a valid `RelayDescriptor`.

## Purpose and Trust Boundaries

The host verifies devices, membership, and roles, maintains current group state, orders events and key epochs, and distributes relay secrets to authorized devices. Current members share a client group secret. Group message keys MUST derive from both client and relay secrets, so the relay alone cannot decrypt messages.

Clients verify members and public keys through the permanently retained [administration chain](core-objects.md#client-verification-and-recovery). They reconstruct membership locally and MUST complete administration verification before wrapping secrets.

Collusion between the relay and a party holding the client secret may decrypt corresponding messages. This protocol claims neither forward secrecy nor post-compromise security. See [Security boundaries](concepts/model-and-keys.md#security-boundaries) for collusion, disclosure, and rotation limits.

## Protocol Contents

### Concepts and Core Objects

| Section | Contents |
|---|---|
| [Group model and keys](concepts/model-and-keys.md) | Fixed hosting, roles, separate secrets, commitments, key boxes, and group application secret derivation |
| [Membership and access control](concepts/membership-and-access.md) | Invitations, applications, membership changes, member key reset, and device access intervals |
| [Group timeline and synchronization](concepts/timeline-and-sync.md) | Timeline, retention and access, initial loading, and reconnection |
| [Account-internal group state and secret synchronization](concepts/account-sync.md) | Private-state requests, member private keys, and historical application-secret synchronization among same-account devices |
| [Group messaging and encryption](concepts/messaging-and-encryption.md) | Envelopes, message key derivation and encryption/decryption, business objects, and nickname updates |
| [Core objects](core-objects.md) | Group ID, `GroupState`, `GroupEvent`, and administration chain |

### Methods and Notifications

| Section | Contents |
|---|---|
| [Common method conventions](methods/conventions.md) | Transport, authorization, signing, list pagination, validation, and errors |
| [Lifecycle and synchronization methods](methods/lifecycle-and-sync.md) | Creation, state queries, event synchronization, and closure |
| [Admission methods](methods/admission.md) | Invitations, join applications, and approval |
| [Property and role management](methods/properties-and-roles.md) | Properties, roles, and ownership transfers |
| [Member and ban management](methods/members-and-bans.md) | Leaving, removal, banning, and unbanning |
| [Member key reset methods](methods/member-recovery.md) | Reset request submission, listing, approval, and rejection |
| [Key methods](methods/keys.md) | Key synchronization and client-secret rotation |
| [Message methods](methods/messaging.md) | Sending and idempotent retries |
| [Subscription methods](methods/subscription.md) | Set replacement, limits, access checks, and post-subscription synchronization |
| [Notifications](notifications/README.md) | Hints for event, application, and member-reset list changes |

## Method Index

All methods below use device sessions.

| Method | HTTP | WebSocket |
|---|---|---|
| [`group.create`](methods/lifecycle-and-sync.md#groupcreate) | POST | JSON-RPC |
| [`group.resolve`](methods/lifecycle-and-sync.md#groupresolve) | GET | JSON-RPC |
| [`group.sync`](methods/lifecycle-and-sync.md#groupsync) | GET | JSON-RPC |
| [`group.close`](methods/lifecycle-and-sync.md#groupclose) | DELETE | JSON-RPC |
| [`group.invite.create`](methods/admission.md#groupinvitecreate) | POST | JSON-RPC |
| [`group.invite.resolve`](methods/admission.md#groupinviteresolve) | GET | JSON-RPC |
| [`group.invite.list`](methods/admission.md#groupinvitelist) | GET | JSON-RPC |
| [`group.invite.revoke`](methods/admission.md#groupinviterevoke) | DELETE | JSON-RPC |
| [`group.application.submit`](methods/admission.md#groupapplicationsubmit) | POST | JSON-RPC |
| [`group.application.list`](methods/admission.md#groupapplicationlist) | GET | JSON-RPC |
| [`group.application.approve`](methods/admission.md#groupapplicationapprove) | POST | JSON-RPC |
| [`group.application.reject`](methods/admission.md#groupapplicationreject) | DELETE | JSON-RPC |
| [`group.update`](methods/properties-and-roles.md#groupupdate) | PATCH | JSON-RPC |
| [`group.role.update`](methods/properties-and-roles.md#grouproleupdate) | PUT | JSON-RPC |
| [`group.owner.transfer`](methods/properties-and-roles.md#groupownertransfer) | POST | JSON-RPC |
| [`group.member.leave`](methods/members-and-bans.md#groupmemberleave) | DELETE | JSON-RPC |
| [`group.member.remove`](methods/members-and-bans.md#groupmemberremove) | DELETE | JSON-RPC |
| [`group.member.ban`](methods/members-and-bans.md#groupmemberban) | PUT | JSON-RPC |
| [`group.member.unban`](methods/members-and-bans.md#groupmemberunban) | DELETE | JSON-RPC |
| [`group.member.recovery.submit`](methods/member-recovery.md#groupmemberrecoverysubmit) | POST | JSON-RPC |
| [`group.member.recovery.list`](methods/member-recovery.md#groupmemberrecoverylist) | GET | JSON-RPC |
| [`group.member.recovery.approve`](methods/member-recovery.md#groupmemberrecoveryapprove) | POST | JSON-RPC |
| [`group.member.recovery.reject`](methods/member-recovery.md#groupmemberrecoveryreject) | DELETE | JSON-RPC |
| [`group.key.sync`](methods/keys.md#groupkeysync) | GET | JSON-RPC |
| [`group.secret.rotation.prepare`](methods/keys.md#groupsecretrotationprepare) | PATCH | JSON-RPC |
| [`group.secret.rotation.commit`](methods/keys.md#groupsecretrotationcommit) | POST | JSON-RPC |
| [`group.message.send`](methods/messaging.md#groupmessagesend) | POST | JSON-RPC |
| [`group.subscribe`](methods/subscription.md#groupsubscribe) | N/A | JSON-RPC |

HTTP/WSS mapping and errors follow [Common group method conventions](methods/conventions.md).

## Notification Index

- [`group.timeline.changed`](notifications/README.md#grouptimelinechanged)
- [`group.application.changed`](notifications/README.md#groupapplicationchanged)
- [`group.member.recovery.changed`](notifications/README.md#groupmemberrecoverychanged)

Envelopes follow [Client–relay notification conventions](../notifications/README.md).

## Conformance Requirements

Conforming implementations MUST follow [Conformance testing boundaries](../../test-vectors/README.md#conformance-testing-boundaries) and [Common client method conventions](../methods/conventions.md), covering:

- Requests and commits: verify complete requests, device signatures and account binding, independent approver verification, field/resource boundaries, HTTP/WSS error mapping and disclosure boundaries under [Common group conventions](methods/conventions.md). Concurrency and failure MUST NOT leave partial state, events, keys, access intervals, or invitation counts.
- Administration state: verify creation, property/role updates, transfers, leaving, removal, banning/unbanning, capacity limits, and member projections under the [Administration chain](core-objects.md#administration-chain) and [Membership and access control](concepts/membership-and-access.md), including same-value updates, old-head replay, unknown administration types, and suspension after failed verification.
- Invitations and approval: verify sharing, viewing, usage permissions, application retries/replacement, key resets, expiry, and dependent deletion under [Admission](methods/admission.md) and [Member key reset](methods/member-recovery.md). [List pagination](methods/conventions.md#list-pagination-rules) must cover cursors, empty pages, list/permission changes, complete traversal of unchanged lists, and list results not substituting for current-state checks at submission.
- Secrets and rotation: verify separate secrets, commitments, both box types and derivation, two-phase client rotation and relay rotation under [Key model](concepts/model-and-keys.md) and [Key methods](methods/keys.md), including batches/replacement, late retries, non-refreshing deadlines, member changes, complete coverage, owner key changes, and activating candidate material only after verification.
- Key and private-state recovery: verify staging independently arriving material, private-key selection and revision confirmation from verified history, historical/current box recovery, and cross-page/adjacent box omission under [Account-internal synchronization](concepts/account-sync.md) and [`group.key.sync`](methods/keys.md#groupkeysync). Missing historical keys do not block administration verification or current-epoch recovery.
- Events and access: verify new-device entry, boundaries and multiple intervals, differing management/message visibility, nonconsecutive sequences and epochs, message authentication, and chain reconstruction under [Device access intervals](concepts/membership-and-access.md#device-access-intervals) and [`group.sync`](methods/lifecycle-and-sync.md#groupsync). Snapshots, notifications, and private material cannot advance verified state or cursors.
- Messages and nicknames: verify complete envelopes, random nonces, AAD, current permissions, result retention, bodies/attachments, replies, and local nickname ordering, clearing, and rejoin boundaries under [Group messaging and encryption](concepts/messaging-and-encryption.md) and [Idempotent retries](methods/messaging.md#idempotent-group-message-retries). Handle business plaintext errors separately from administration-event errors.
- Subscriptions and notifications: verify replacement, clearing, reduced limits, failure details, and preservation of device access intervals under [Subscriptions](methods/subscription.md) and [Notifications](notifications/README.md), including event-hint coalescing, unversioned list refresh, and notifications after request expiry/deletion.
- Retention and closure: verify message/old-key pruning, current-key recovery, permanent retention of administration events and verification certificates, and irreversible closure under [Retention and access](concepts/timeline-and-sync.md#group-data-retention-and-access-rules) and [`group.close`](methods/lifecycle-and-sync.md#groupclose). After closure, reads and message/key retention are not guaranteed.
