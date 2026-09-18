# Group Notifications

[Group hosting protocol](../README.md) · [Client–relay notifications](../../notifications/README.md) · [Group subscription methods](../methods/subscription.md)

Notifications go only to valid device-session connections subscribed to the group. Sending follows [Atomic commit and persistence rules](../methods/conventions.md#atomic-commit-and-persistence-rules). Arrival may be out of order; filtering, coalescing, and catch-up follow [Notification handling rules](../../notifications/README.md#notification-handling-rules).

For initial loading or reconnection, clients may follow [Group synchronization and recovery](../concepts/timeline-and-sync.md#group-synchronization-and-recovery-flow). Post-subscription event catch-up follows [`group.subscribe`](../methods/subscription.md#groupsubscribe).

## `group.timeline.changed`

After new events, the relay sends this to subscribed connections with current read permission.

### Notification Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | Changed group's ID |
| `head` | integer | Yes | Highest assigned group sequence observed when generating the notification |

### Processing Rules

When catch-up is needed, call [`group.sync`](../methods/lifecycle-and-sync.md#groupsync) from the locally completed position; obtain missing epoch material under [`group.key.sync`](../methods/keys.md#groupkeysync).

## `group.application.changed`

Send to subscribed current owners and administrators when pending applications change through creation, replacement, approval, rejection, deletion, or invitation invalidation.

### Notification Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | Group whose pending application list changed |

### Processing Rules

Refresh pending applications with [`group.application.list`](../methods/admission.md#groupapplicationlist) as needed.

## `group.member.recovery.changed`

When pending resets change through creation, replacement, withdrawal, approval, rejection, deletion, or expiry, send to subscribed request-owner accounts and current owners/administrators authorized to process at least one request.

Departure, removal, banning, or an owner's member-key change during client-secret rotation MUST also trigger this notification if successful commit actually deletes a pending reset. Recipients of deletion hints MUST still have group access: the current owner receives them; administrators receive them if authorized to view at least one deleted request before deletion; request owners receive them if they still have group access.

### Notification Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | Group whose reset list visible to this account changed |

### Processing Rules

To refresh visible pending resets, call [`group.member.recovery.list`](../methods/member-recovery.md#groupmemberrecoverylist) and validate returned records under that method.
