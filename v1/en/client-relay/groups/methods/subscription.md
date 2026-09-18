# Group Subscription Methods

[Group hosting protocol](../README.md) · [Common method conventions](conventions.md)

## `group.subscribe`

`group.subscribe` atomically replaces the current WebSocket connection's group subscription set, enabling corresponding [group notifications](../notifications/README.md).

| Item | Convention |
|---|---|
| HTTP | Unsupported |
| Session requirement | Device session |
| WSS | `group.subscribe` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_ids` | array&lt;string&gt; | Yes | Complete desired set after success; empty clears all subscriptions; every group MUST be hosted here and readable by the account; IDs distinct, with count checked below |

### Response Object

None.

### Processing and Errors

#### Parameter and Session Validation

Relays MUST validate parameters and device session. Duplicate/invalid IDs or count violations return `bad_request`; invalid sessions return `unauthorized`; wrong mode returns `forbidden`. If these errors occur, choose an actually applicable error and omit `error.data`.

Count checks use the connection's still-valid set immediately before replacement. Any newly subscribed group requires the complete new count to fit current `relay.info.limits.max_group_subscriptions`. Without additions, an over-limit count alone MUST NOT cause rejection. Order does not affect set comparison. Re-adding an unsubscribed group counts as an addition.

#### Hosting and Access Validation

Relays MUST also check every group's host and access. Missing, differently hosted, nonmember, or banned-account groups cannot be subscribed. With valid parameters and session, any unavailable subscription rejects the entire request:

| Condition | Error code |
|---|---|
| At least one group is missing or hosted elsewhere | `not_found` |
| All exist and are hosted here, but at least one denies account/device access | `forbidden` |

Both group-check errors MUST supply this [JSON-RPC error](../../methods/conventions.md#error-responses) `data`:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_ids` | array&lt;string&gt; | Yes | All requested groups that cannot be subscribed, including both hosting and access failures; nonempty, distinct, each from request `group_ids` |

Failure preserves the original subscription set and every group's device access intervals.

#### Subscription Activation and Synchronization

If every group is eligible, completely replace the connection's set and establish needed [device access intervals](../concepts/membership-and-access.md#device-access-intervals). Unsubscribing ends no access interval and changes no membership, state, event, or epoch. Successful repetition preserves the set and still-valid starting points; new intervals, if needed, still follow those rules.

Success does not proactively return current state or queued notifications. Clients are advised to call `group.sync` for newly added subscriptions to catch events missed before activation. Still-valid subscriptions retained on the same connection need no extra synchronization solely for set changes or repeated submission. Disconnection or resubscription does not reset completed local positions.

Catch-up required by notifications, known gaps, or other recovery conditions still applies; continuous subscription does not waive it. Retrieve key material through [`group.key.sync`](keys.md#groupkeysync) as needed; already available material verified under its original rules may be reused.
