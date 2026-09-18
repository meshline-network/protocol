# Group Timeline and Synchronization

[Group hosting protocol](../README.md) · [Group model and keys](model-and-keys.md)

## Group Timeline and Synchronization Rules

Each group has one timeline with strictly increasing `sequence`, starting at 0 without requiring later continuity. Client-signed administration events are linked under the [Administration chain](../core-objects.md#participating-events-and-predecessor-references); messages and relay-initiated rotation do not advance it. Writes follow [Atomic commit and persistence rules](../methods/conventions.md#atomic-commit-and-persistence-rules).

Clients read all administration events and messages in authorized intervals through [`group.sync`](../methods/lifecycle-and-sync.md#groupsync), verifying and reconstructing state under that method and the [Administration chain](../core-objects.md#client-verification-and-recovery). Positions may advance per event or in batches. Later processing failures do not invalidate completed results or progress, but the cursor MUST NOT pass an event not fully processed under this protocol.

## Group Synchronization and Recovery Flow

For initial loading or reconnection, members may use this flow:

1. Determine `group_id` and host, then establish a device session. If private state is missing, send [`AccountGroupPrivateStateRequest`](account-sync.md#accountgroupprivatestaterequest) to same-account devices.
2. For WebSocket notifications, submit [`group.subscribe`](../methods/subscription.md#groupsubscribe) first, then catch up after success. Skip subscription for HTTP-only synchronization.
3. Call [`group.sync`](../methods/lifecycle-and-sync.md#groupsync) to catch up, verify events, and reconstruct state. Retrieve missing epoch material with [`group.key.sync`](../methods/keys.md#groupkeysync) as needed.
4. Once administration history is verified through an epoch and its material is available, recover or reuse its verified application secret under `group.key.sync`. Process messages once their events arrive. Missing historical keys do not block current-epoch recovery.
5. During and after synchronization, filter or coalesce hints under [Notification handling rules](../../notifications/README.md#notification-handling-rules), continuing event catch-up from the completed position and retrieving keys as needed.

## Group Data Retention and Access Rules

### Event and State Retention

`group_message_retention` in `relay.info` is the minimum message-event retention. Each deadline uses `accepted_at` plus the period at acceptance; cleanup is allowed afterward. For idempotency-result retention, see [Group message idempotent retries](../methods/messaging.md#idempotent-group-message-retries).

Administration events and certificates needed to verify their signatures are permanently retained, including creation, client administration operations, and relay-initiated rotations. Original application and key-reset material follows its own business lifecycle.

While the group exists, retain current state, internal member and ban state, device access permissions, and valid business records. Message cleanup does not change them, roll back timeline or administration heads, or reuse sequences.

### Key Material Retention

Current keys and keys required by messages still within retention MUST NOT be cleaned up early.

While the group exists, the relay MUST retain the boxes each current member needs to unwrap the current client secret.

Old relay secrets and corresponding boxes are retained at least until the last message depending on that epoch expires. After cleanup, `group.key.sync` no longer returns the epoch. Without corresponding old member private keys, historical client boxes cannot be unwrapped. Already verified historical application secrets may directly derive message keys without unwrapping again. Clients requiring long-term history should save bodies, attachment references, and corresponding application secrets before expiry.

### Read Permissions and Closure

Devices with current group read permission may read all administration events; messages are readable only within authorized intervals. Leaving, removal, banning, or lack of current device permission rejects reads. Closure guarantees neither continued read service nor message and key retention.
