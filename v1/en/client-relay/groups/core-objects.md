# Group Core Objects

[Group hosting protocol](README.md)

## Group ID

The creator generates a new 16-byte `nonce`, never reused by the same creator on the same relay; a cryptographically secure random source is recommended. Compute SHA-256 over the [network-bound JSON input](../../general.md#network-bound-json-inputs) of this identity object:

```json
{
  "$type": "meshline.group.identity",
  "creator": "neo:860833102:...",
  "nonce": "base64url...",
  "relay_id": "0x..."
}
```

`creator` is the initial owner and `relay_id` the selected host; both and `nonce` remain unchanged throughout the group lifecycle. The group ID is as follows, where `group_identity_input` means the group identity object above:

```text
group_id = "grp_" + base64url(first_16_bytes(SHA-256(network_bound_json_bytes(group_identity_input))))
```

`group_id` MUST match `^grp_[A-Za-z0-9_-]{22}$`. Name, description, members, capacity, invitation policy, event positions, and key epochs do not participate. The ID binds the host but does not reveal it by reverse derivation.

## `GroupState`

`GroupState` is current group state maintained by the host:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | Group described by this state |
| `name` | string | Yes | Current name; MUST include a non-[whitespace character](../../general.md#text-whitespace-characters); at most 256 UTF-8 bytes |
| `description` | string | Yes | Current description; if nonempty, MUST NOT be solely [whitespace](../../general.md#text-whitespace-characters); at most 4 KiB (4,096 UTF-8 bytes) |
| `status` | string | Yes | `active` means existing; `closed` means permanently closed |
| `owner` | string | Yes | Owner account, appearing exactly once in current membership with role `owner` |
| `member_capacity` | integer | Yes | Positive member-count limit; may temporarily be below current count, retaining existing members but rejecting further admission |
| `member_count` | integer | Yes | Positive current count, including owner and administrators |
| `invite_policy` | string | Yes | Invitation policy; owner and administrators are not restricted by it |

`invite_policy` means:

| Value | Invitations ordinary members may create |
|---|---|
| `administrators` | None |
| `members_targeted` | Only targeted invitations naming `invitee` |
| `members_shareable` | Targeted and public invitations |

Membership is indexed by group and account IDs and contains `account`, `role`, and `member_encryption_public_key`. Clients establish membership, roles, and keys from the verified [administration chain](#client-verification-and-recovery).

While the group exists, the relay MUST retain current state and membership. State-changing methods MUST atomically update projections and append corresponding events.

## `GroupEvent`

`GroupEvent` is an authoritative timeline entry appended by the host for administration, key rotation, and messages:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `sequence` | integer | Yes | Unique assigned position; creation is 0, later values strictly exceed the prior head without required continuity. Clients use it for ordering, pagination, and message references |
| `epoch` | integer | Yes | [Key epoch](concepts/model-and-keys.md#client-and-relay-secrets) after the event; creation is 0, messages MUST match their envelope, and events not advancing keys retain the preceding event's epoch in the complete timeline |
| `payload` | object | Yes | Complete event body identified by `payload.$type`; structure and handling follow its object/method definition |
| `accepted_at` | integer | Yes | Relay acceptance UTC Unix seconds, used for retention, not as a substitute for sequence ordering |
| `signer_device_id` | string | Conditional | Device verified at client-write acceptance; required for client events, referencing `group.sync` certificates, and omitted for relay-initiated rotation |

Across the complete timeline, `epoch` is nondecreasing without required continuity.

Messages have `payload.$type = meshline.group.message` and may expire under [Retention and access](concepts/timeline-and-sync.md#group-data-retention-and-access-rules). Other events are administration events, permanently retained with verification certificates.

Message filtering/pruning or starting mid-history may make adjacent visible events nonadjacent in the full timeline. Administration events are unrestricted by message intervals and MUST NOT be pruned; complete synchronization from creation obtains all of them. Epoch handling follows [`group.sync`](methods/lifecycle-and-sync.md#groupsync).

Invitation creation/revocation, application submission/rejection, key-reset request submission/replacement/withdrawal/rejection, and client-secret rotation preparation do not enter the timeline. Approvers verify these pending records when acting. Join approval records authorized accounts and keys; reset approval records accounts and new keys. Banning and unbanning affect future permissions, so successful calls MUST write complete signed requests into the administration chain.

### Relay Secret Rotation Events

Relay-initiated rotation generates this payload:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.group.key.rotated` |

The new epoch is outer `GroupEvent.epoch`. This relay-generated body carries no `device_signature`, and outer `signer_device_id` MUST be omitted. Clients check the fixed type and epoch advancement. It is permanently retained but changes neither members, roles, bans, client-secret commitment, nor administration head.

## Administration Chain

### Participating Events and Predecessor References

The chain links only client-signed administration events actually written to the timeline. Messages and relay rotations do not advance it. Participating body types are:

| Body `$type` | Effect |
|---|---|
| `meshline.group.create` | Establish group, initial owner, and client-secret commitment |
| `meshline.group.application.approval` | Admit members |
| `meshline.group.update` | Change properties |
| `meshline.group.role.update` | Change administrative roles |
| `meshline.group.owner.transfer` | Transfer ownership |
| `meshline.group.member.leave` | Signing account leaves |
| `meshline.group.member.removal` | Remove target members |
| `meshline.group.member.recovery.approval` | Approve new member public keys |
| `meshline.group.secret.rotation` | Update commitment and optional owner key |
| `meshline.group.member.ban` | Ban targets and remove current members among them |
| `meshline.group.member.unban` | Lift bans |
| `meshline.group.close` | Permanently close |

Creation starts the chain without `prev_hash`. Every other listed request's signed body MUST carry the previous locally verified administration digest as `prev_hash`, matching `^sha256:[A-Za-z0-9_-]{43}$`, decoding to 32 bytes in canonical unpadded base64url. It is signed with all business fields and cannot be added or rewritten by the relay after verification. Requests not written do not advance the chain; message envelopes and relay-rotation bodies do not define this field.

### Administration Digest Calculation

For administration event E, hash the network-bound input of complete `payload`, retaining root `device_signature` and all unknown properties:

```text
management_hash(E) = network_bound_json_hash(E.payload)
```

Construction follows [Network-bound JSON inputs](../../general.md#network-bound-json-inputs). The digest includes the body signature; body signing excludes only root `device_signature`. `signer_device_id` locates the certificate; clients still MUST verify certificate, body signature, and account permission. Other outer fields retain ordering, time, and key checks. The next operation references `management_hash(E)`.

### Relay Commit and Concurrency Control

Relays MUST validate session, signature, and caller permissions. Creation establishes the starting point under [`group.create`](methods/lifecycle-and-sync.md#groupcreate). Other requests MUST have `prev_hash` equal to the current head, with both permission and equality still holding at activation. Violating field constraints returns `bad_request`.

Success MUST append an administration event and update the head. Request evidence, state, event, timeline head, and administration head MUST commit atomically.

Of two requests citing one head, only one can succeed. To resubmit the other, synchronize new events, recheck permissions and operation content, and sign again. Clients MUST NOT replace only the digest while reusing the old signature.

### Client Verification and Recovery

#### Chain Verification and State Reconstruction

Initially verify from creation: check expected ID derivation, creator account, certificate, and creation signature, establish state, and compute the head. Then verify each `prev_hash`, signature, and signer's membership, role, and ban state in the preceding state, apply the method's effects, and compute the new head.

Members are distinct by account, with no duplicates; roles are `owner`, `administrator`, or `member`. Creation establishes the owner; admission establishes ordinary members. Role changes, transfers, leaving, removal/banning, reset approval, and client rotation modify membership under their methods. Rejoining uses the newly approved key and cannot restore the old member record. Pending applications/resets do not change effective state.

Bans start empty. Clients obtain events through [`group.sync`](methods/lifecycle-and-sync.md#groupsync), adding and removing accounts according to verified ban/unban requests to reconstruct the set.

Applicants and resetting members sign complete requests containing their public keys. Approvers independently verify request signatures, certificates, and account binding, then sign those accounts and keys in approval objects. Other clients verify approval events and prior approver authority. Public-key sourcing and validation before secret wrapping MUST follow [Client secret boxes](concepts/model-and-keys.md#client-secret-boxes).

#### Verification Interruption and Recovery

Missing intermediate administration events, invalid signatures, unauthorized operations, or uninterpretable administration extensions block later state verification; ordinary-message rejection rules MUST NOT be used to skip them. Unknown client administration body types MUST pause the projection until an extension defines hashing participation and state rules. Clients may retain them for reprocessing. Unknown properties still participate in hashes and signatures but affect state only as defined by known method fields.

On local reload, verified administration head, membership, bans, and synchronization position MUST remain consistent. Continue the verified chain rather than replacing it with a relay snapshot. On verification failure, stop applying later administration events and report an error. Missing records may be requested again through [`group.sync`](methods/lifecycle-and-sync.md#groupsync).
