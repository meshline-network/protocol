# Group Member and Ban Management Methods

[Group hosting protocol](../README.md) · [Common method conventions](conventions.md)

## `group.member.leave`

A current non-owner member leaves immediately.

| Item | Convention |
|---|---|
| HTTP | `DELETE /meshline/v1/group/member/leave` |
| Session requirement | Device session |
| WSS | `group.member.leave` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.member.leave` |
| `group_id` | string | Yes | Group the caller leaves |
| `account` | string | Yes | Leaving account, matching session and signer-certificate account |
| `prev_hash` | string | Yes | Previous [administration digest](../core-objects.md#participating-events-and-predecessor-references), still current at submission |
| `device_signature` | string | Yes | Leaving member's calling device signs the complete request excluding this field |

### Response Object

None.

### Processing and Errors

Check account/session equality and that the account remains a current unbanned non-owner at activation.

Invalid fixed fields/account format returns `bad_request`; missing group returns `not_found`; account mismatch, nonmembership, owner status, or ban returns `forbidden`; concurrency conflict returns `state_conflict`.

Resubmitting the same request with a valid session returns `forbidden` because the caller is no longer a member.

Success removes membership, closes all account device intervals, deletes its pending reset, generates a new relay secret, advances one epoch, and appends the leave event. If rotation preparation exists, the same atomic commit MUST remove this member's staged box under [`group.secret.rotation.prepare`](keys.md#groupsecretrotationprepare), retaining other boxes and original expiry. Voluntary departure does not invalidate preparation. After persistence, send `group.timeline.changed`; actual deletion of a pending reset additionally requires `group.member.recovery.changed` under the [deletion recipient scope](../notifications/README.md#groupmemberrecoverychanged).

Clients verifying leave events MUST confirm that the referenced certificate belongs to `account`, verify the body signature and prior-state leave permission, then apply departure by that account.

## `group.member.remove`

Owner or administrators remove one or more members. Owners may remove any non-owner; administrators only ordinary members. Neither the calling account nor current owner may be targeted.

| Item | Convention |
|---|---|
| HTTP | `DELETE /meshline/v1/group/member/remove` |
| Session requirement | Device session |
| WSS | `group.member.remove` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.member.removal` |
| `group_id` | string | Yes | Target members' group |
| `prev_hash` | string | Yes | Previous [administration digest](../core-objects.md#participating-events-and-predecessor-references), still current at submission |
| `accounts` | array&lt;string&gt; | Yes | Nonempty, distinct current member accounts to remove |
| `device_signature` | string | Yes | Initiating owner/administrator's calling device signs the complete request excluding this field |

### Response Object

None.

### Processing and Errors

Invalid fixed fields, empty batch, or duplicate accounts returns `bad_request`; missing group returns `not_found`; insufficient owner/administrator role, caller ban, targeting owner/caller, or administrator targeting an administrator returns `forbidden`. Any noncurrent target or concurrent membership change returns `state_conflict`.

Validate all targets first, then atomically remove the entire batch, close target intervals, clean pending resets, generate one relay secret, advance one epoch, and append one event. Existing rotation preparation MUST lose these members' staged boxes in the same commit under [`group.secret.rotation.prepare`](keys.md#groupsecretrotationprepare), retaining others and original expiry. Removal does not invalidate preparation.

After persistence, send `group.timeline.changed`; actual pending-reset deletion also sends `group.member.recovery.changed` under [deletion recipient scope](../notifications/README.md#groupmemberrecoverychanged).

## `group.member.ban`

Owners may ban any non-owner account; administrators only ordinary members or nonmembers. Bans add targets to the set and prohibit group interfaces and rejoining.

| Item | Convention |
|---|---|
| HTTP | `PUT /meshline/v1/group/member/ban` |
| Session requirement | Device session |
| WSS | `group.member.ban` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.member.ban` |
| `group_id` | string | Yes | Group in which to ban |
| `prev_hash` | string | Yes | Previous [administration digest](../core-objects.md#participating-events-and-predecessor-references), still current at submission |
| `accounts` | array&lt;string&gt; | Yes | Nonempty distinct target IDs; may include current members, nonmembers, and already banned accounts |
| `device_signature` | string | Yes | Initiating owner/administrator's calling device signs the complete request excluding this field |

### Response Object

None.

### Processing and Errors

#### Validation and Ban Count Limits

Invalid fixed values, empty array/accounts, or duplicates returns `bad_request`; missing group returns `not_found`; insufficient role, caller ban, targeting owner, or administrator targeting administrator returns `forbidden`. New bans causing the merged count to exceed the configured cap, or concurrency conflicts, return `state_conflict`.

Calculate additions and total from current ban state at activation; already banned targets do not count twice. After cap reduction, requests targeting only already banned accounts cannot be rejected solely because the existing total exceeds the new cap, but still require permission, signatures, and current head. Mixed batches with additions exceeding the cap are rejected entirely.

#### State Changes and Notifications

Validate the whole batch's permissions and cap, then atomically merge bans, delete all targets' pending join applications, remove current members among them, close their device intervals, and clean their pending resets. Application deletion consumes no invitation uses. If any members were removed, generate one relay secret and advance one epoch. In the same commit, existing rotation preparation MUST remove actually removed members' boxes under [`group.secret.rotation.prepare`](keys.md#groupsecretrotationprepare), preserving others and original expiry. Banning does not invalidate preparation. If no targets are current members, membership, intervals, keys, and staged rotation remain unchanged. Any failed check prevents the entire batch from taking effect.

Each success appends exactly one complete signed `meshline.group.member.ban` administration event and atomically advances the chain, without extra removal events.

After persistence, send `group.timeline.changed`; deleted applications additionally trigger `group.application.changed`; actual pending-reset deletion triggers `group.member.recovery.changed` under [deletion recipient scope](../notifications/README.md#groupmemberrecoverychanged).

Clients verify permission from preceding membership, remove target members, and update bans together.

## `group.member.unban`

Owner or administrators lift one or more bans at once.

| Item | Convention |
|---|---|
| HTTP | `DELETE /meshline/v1/group/member/unban` |
| Session requirement | Device session |
| WSS | `group.member.unban` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.member.unban` |
| `group_id` | string | Yes | Group in which to unban |
| `prev_hash` | string | Yes | Previous [administration digest](../core-objects.md#participating-events-and-predecessor-references), still current at submission |
| `accounts` | array&lt;string&gt; | Yes | Nonempty distinct IDs to remove from the ban set; may include currently unbanned accounts |
| `device_signature` | string | Yes | Initiating owner/administrator's calling device signs the complete request excluding this field |

### Response Object

None.

### Processing and Errors

Invalid fixed values, empty array/accounts, or duplicates returns `bad_request`; missing group returns `not_found`; insufficient role or caller ban returns `forbidden`; concurrency conflict returns `state_conflict`.

Atomically remove listed existing bans, append the complete signed request, and advance the chain. Unbanning restores no deleted applications, membership, roles, or closed message/key intervals. Rejoining follows ordinary application/approval. Membership and epoch remain unchanged; clients update bans through the chain.

After persistence, send `group.timeline.changed`.
