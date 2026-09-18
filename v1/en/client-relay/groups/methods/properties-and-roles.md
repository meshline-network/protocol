# Group Property and Role Management Methods

[Group hosting protocol](../README.md) · [Common method conventions](conventions.md)

## `group.update`

The owner changes name, description, member capacity, or invitation policy.

| Item | Convention |
|---|---|
| HTTP | `PATCH /meshline/v1/group/update` |
| Session requirement | Device session |
| WSS | `group.update` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.update` |
| `group_id` | string | Yes | Group to update, still active |
| `prev_hash` | string | Yes | Previous [administration digest](../core-objects.md#participating-events-and-predecessor-references), still current at submission |
| `name` | string | No | Replaces the name if present; MUST include a non-[whitespace character](../../../general.md#text-whitespace-characters), at most 256 UTF-8 bytes; omission preserves it |
| `description` | string | No | Replaces description if present; if nonempty, not solely [whitespace](../../../general.md#text-whitespace-characters), at most 4,096 UTF-8 bytes; omission preserves it |
| `member_capacity` | integer | No | Replaces capacity if present; positive. Increases cannot exceed current relay `max_group_members`; retaining/reducing existing capacity is not constrained by a subsequently reduced cap; omission preserves it |
| `invite_policy` | string | No | Replaces policy if present, with values from [`GroupState.invite_policy`](../core-objects.md#groupstate); omission preserves it |
| `device_signature` | string | Yes | Current owner's calling device signs the complete update excluding this field |

At least one modifiable field MUST be supplied. Capacity may fall below current membership, but count after admission MUST NOT exceed it.

Only `name`, `description`, `member_capacity`, and `invite_policy` are modified. Unknown properties remain signed and preserved in the event but are not merged into `GroupState` and change neither members nor outer event fields. They cannot satisfy the modifiable-field requirement.

### Response Object

None.

### Processing and Errors

Invalid fixed values, name, description, capacity, or policy returns `bad_request`; missing group returns `not_found`; non-owner or banned caller returns `forbidden`; concurrency conflict returns `state_conflict`.

After validation, update supplied properties, append the complete update as event `payload`, and advance the administration head. After persistence, send `group.timeline.changed`. Epoch is unchanged.

## `group.role.update`

The owner sets one current non-owner member's role.

| Item | Convention |
|---|---|
| HTTP | `PUT /meshline/v1/group/role/update` |
| Session requirement | Device session |
| WSS | `group.role.update` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.role.update` |
| `group_id` | string | Yes | Target member's group |
| `prev_hash` | string | Yes | Previous [administration digest](../core-objects.md#participating-events-and-predecessor-references), still current at submission |
| `account` | string | Yes | Current non-owner target account |
| `role` | string | Yes | New role, only `administrator` or `member` |
| `device_signature` | string | Yes | Current owner's calling device signs the complete update excluding this field |

### Response Object

None.

### Processing and Errors

Invalid role/fixed fields returns `bad_request`; missing group returns `not_found`; non-owner or banned caller returns `forbidden`; a target not currently a non-owner member or concurrent membership change returns `state_conflict`.

After checks, update the target's role, append the complete signed object as event payload, and advance the administration head. Notify after persistence. Membership, public keys, access intervals, and epoch remain unchanged.

## `group.owner.transfer`

The current owner transfers ownership to another current unbanned member.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/group/owner/transfer` |
| Session requirement | Device session |
| WSS | `group.owner.transfer` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.owner.transfer` |
| `group_id` | string | Yes | Group whose ownership is transferred |
| `prev_hash` | string | Yes | Previous [administration digest](../core-objects.md#participating-events-and-predecessor-references), still current at submission |
| `new_owner_account` | string | Yes | Designated successor, another current unbanned member |
| `device_signature` | string | Yes | Current owner's calling device network-bound signature over the complete request excluding this field |

### Response Object

None.

### Processing and Errors

Invalid fixed fields, hash, or account format returns `bad_request`; missing group returns `not_found`; non-owner caller, target not another current member, or banned target/caller returns `forbidden`. After permission checks, a noncurrent hash or concurrent member-state conflict returns `state_conflict`.

Success makes the target owner and former owner an ordinary member, updates `owner`, appends the complete signed transfer and advances the chain, and deletes the former owner's staged rotation. Membership set, access intervals, and epoch do not change.
