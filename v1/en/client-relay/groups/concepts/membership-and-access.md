# Membership and Access Control

[Group hosting protocol](../README.md) · [Core objects](../core-objects.md)

Request validation follows [Common method conventions](../methods/conventions.md#validation-and-error-handling-rules). Historical signatures and authorization follow [`group.sync`](../methods/lifecycle-and-sync.md#groupsync). Role permissions appear in the [Role table](model-and-keys.md#role-permissions).

## Invitations, Applications, and Capacity Limits

### Invitation Rules

Creation permission follows [`GroupState`](../core-objects.md#groupstate) invitation policy and is checked at creation. Later use relies on the authorization already completed when the relay accepted the invitation.

Targeted invitations are usable once only by the named account. Public invitations may serve multiple accounts, with successful uses limited by `max_uses`. Until expiry, revocation, or exhaustion, they remain usable for applications; later issuer departure/demotion or policy changes do not automatically revoke them.

Applications inherit invitation validity without a separate expiry. Once an invitation is exhausted, expired, or revoked, dependent pending applications immediately become invalid and cannot be approved. Submission, invalidation, and rejection consume no uses; only successful approval adding members atomically consumes them.

The relay retains at least complete invitations, issuing-device certificates, and use counts still referenced by valid pending applications, so administrators can verify originals by `invite_id`.

### Applications and Approval

An applicant may first use a valid applicable invitation with `group.resolve` to inspect current state, without consuming it or gaining event/key access.

Submit a device-signed application under [`group.application.submit`](../methods/admission.md#groupapplicationsubmit). The relay saves the complete application and certificate verified at acceptance for independent approver verification. New same-account applications replace older pending ones. Submission changes neither membership nor chain.

Owner or administrators may approve one or more applications at once. Success atomically adds members, generates a new relay secret, advances one epoch, and appends one approval event. See [`group.application.approve`](../methods/admission.md#groupapplicationapprove). New members MUST verify received boxes under [Client secret boxes](model-and-keys.md#client-secret-boxes) using verified administration history.

### Capacity Limits

`member_capacity` may fall below current count without invalidating members. While count is at least capacity, new approvals MUST fail. Pending applications reserve no capacity; concurrent approvals are governed by the first successful activation.

Later reduction of relay `max_group_members` does not invalidate existing members or capacity. Keeping or reducing capacity remains possible even above the new cap. Creation and expansion MUST meet the relay cap at activation.

## Membership Changes and Bans

### Membership Changes

`group.member.leave` immediately ends the caller's current membership and appends an event; owners must transfer ownership first. Owner or administrators use `group.member.remove` to remove one or more current members by account.

Joining, leaving, and removal rotate only the relay secret, not the client secret. Success MUST simultaneously update membership, generate a new relay secret, advance epoch, and append an event. Departed/removed accounts cannot subsequently read events or keys.

### Banning and Unbanning

Banning adds targets to the ban set, deletes their pending join applications, and applies removal rules to current members among them, including closing device access intervals, cleaning pending reset requests, and deleting related staged boxes. Any member removal in the batch generates one relay secret and advances one epoch; banning only nonmembers does not. The complete signed ban request forms one administration event proving both ban and removal, without extra removal events.

Banned accounts cannot call group interfaces or rejoin. Unbanning only removes ban state and appends an event; it restores no deleted application, membership, role, or old access interval, and advances no keys. Rejoining requires a new application and approval. Banning does not automatically change client secrets; suspected disclosure is grounds for the owner to rotate them.

## Member Key Reset

A current member who loses its member encryption private key may sign and submit a reset request with a currently valid device. The relay retains request and certificate; approvers independently verify account binding and signature before signing approval and constructing client secret boxes.

### Request Management

Each account has at most one current request, replaced by a new one. Requests are time-limited; after expiry they cannot be withdrawn, approved, or rejected. See [`group.member.recovery.submit`](../methods/member-recovery.md#groupmemberrecoverysubmit) for expiry. Departure, removal, or approval deletes the current request; rejoining does not restore it.

Before approval, the member may withdraw its current request by account. The owner may reject other members' requests; administrators may reject only other ordinary members'. Withdrawal/rejection changes neither public keys, access intervals, epochs, nor timeline.

### Approval and Candidate Material

Owners may approve any current member, including themselves; administrators only other ordinary members. Success atomically replaces target keys, rebuilds device access intervals, and advances one epoch. For batches and handling, see [`group.member.recovery.approve`](../methods/member-recovery.md#groupmemberrecoveryapprove). Box construction and validation follow [Client secret boxes](model-and-keys.md#client-secret-boxes).

Candidate storage follows [`group.member.recovery.submit`](../methods/member-recovery.md#groupmemberrecoverysubmit). Candidate activation, disposal, and verification MUST follow [`group.member.recovery.list`](../methods/member-recovery.md#groupmemberrecoverylist).

## Device Access Intervals

Intervals limit message events and relay-provided key material. Administration events are not limited by interval starts/ends; devices with current read permission may read all administration history from creation. Multiple intervals authorize the union of their message ranges.

### Establishing and Changing Intervals

- The creator device starts at creation; application and reset-request devices start at their approval events, inclusive. Key access starts at that event's epoch, inclusive.
- Other new devices establish message and key starting points on successful `group.subscribe`, `group.sync`, or `group.key.sync`. Messages include only positions after the timeline head at establishment; keys include the current epoch then. Later calls retain original starts. Initial administration synchronization still starts at -1.
- Continuous renewal of the same device ID preserves intervals. Re-enabled invalid devices create new intervals as ordinary new devices, without filling messages or keys from invalid periods, though all administration events remain catch-up accessible.
- Member key reset closes every old interval for that account and removes their authorization for message/key reads. The request device starts a new interval at approval. Other still-account-authorized devices establish new intervals under ordinary new-device rules on their next successful subscription or event/key synchronization, without restoring old read permissions. Device revocation still follows account device state.

After `device.status.changed`, the relay MUST requery and verify under [Cache invalidation and follow-up queries](../../../relay-rpc/notifications/README.md#processing-rules). Confirmed `inactive` closes the current interval. Generate a new relay secret and advance `epoch` only if this device had been returned the current relay secret. Session expiry alone does not close intervals. Relay-secret rotation does not advance the administration head.

### Read Permissions and Historical Boundaries

Retained messages and keys in still-authorized original intervals remain readable. Departure, removal, or current device invalidity rejects all group reads; bans also reject reads while effective.

Retention follows [Group data retention and access](timeline-and-sync.md#group-data-retention-and-access-rules). Readable administration history grants no past-message decryption capability.

Intervals are relay-enforced historical boundaries, not cryptographic historical isolation within an epoch. Events and keys are separately validated under [`group.sync`](../methods/lifecycle-and-sync.md#groupsync) and [`group.key.sync`](../methods/keys.md#groupkeysync).
