# Account-Internal Group State and Secret Synchronization

[Group hosting protocol](../README.md) · [Group timeline and synchronization](timeline-and-sync.md)

Devices of one account exchange private group state through ordinary account messages, without participation by the group host. Account messages MUST NOT carry relay secrets.

Private state and historical group application secrets may be sent proactively and split across account messages. Recipients independently verify and process each message's contents; identity and deduplication follow the outer `MessageEnvelope` rules.

## Account-Internal Private Group State Synchronization

### `AccountGroupPrivateStateRequest`

`AccountGroupPrivateStateRequest` asks other same-account devices for one group's or all current groups' private state.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.account.group.state.request` |
| `group_id` | string | No | Request only this group's current private state; omission requests all current private group state held by the recipient |

Recipients send the corresponding state they hold through [`AccountGroupPrivateStateSync`](#accountgroupprivatestatesync).

### `AccountGroupPrivateStateSync`

`AccountGroupPrivateStateSync` carries a batch of complete private group states.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.account.group.state.sync` |
| `states` | array&lt;GroupMemberPrivateState&gt; | Yes | Current private states in this account message; nonempty, with distinct `group_id` values |

### `GroupMemberPrivateState`

`GroupMemberPrivateState` synchronizes one group's member private key and location among account devices:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | Group to which this state belongs |
| `relay_id` | string | Yes | Hosting relay ID, used to locate group interfaces |
| `member_encryption_private_key` | string | Yes | 32-byte X25519 private key corresponding to this account's current member public key, unpadded base64url; unwraps client secret boxes for that member |

After verifying account-message signature, same-account binding, and field format, recipients save the hosting association and private key.

With multiple keys for one group, clients MUST derive each public key and select the private key matching this account's current public key in locally verified member state. Arrival order MUST NOT determine recency or current-key selection. Matching reflects only locally verified history; a temporarily unmatched key may belong to later unsynchronized state and may be retained as unverified material. It MUST NOT be deemed obsolete or invalid solely for the mismatch, or replace a usable key still matching current verified membership.

Clients reconstruct membership and client-secret commitments through `group.sync`, then unwrap under [`group.key.sync`](../methods/keys.md#groupkeysync) using keys matching corresponding historical member public keys. Current private keys may not unwrap historical boxes. Replaying an early public key does not invalidate other received private keys.

## Account-Internal Historical Group Secret Synchronization

Clients handle long-term message history. Same-account devices may independently exchange application secrets derived for historical epochs:

### `AccountGroupHistorySecretSync`

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.account.group.history_secret.sync` |
| `secrets` | array&lt;GroupHistorySecret&gt; | Yes | Verified historical application secrets in this message; nonempty, with distinct `(group_id, epoch)` pairs |

### `GroupHistorySecret`

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | Group of the historical secret |
| `epoch` | integer | Yes | Corresponding group key epoch |
| `application_secret` | string | Yes | 32-byte secret derived under [Group application secret derivation](model-and-keys.md#group-application-secret-derivation), unpadded base64url |

After account-message authentication and format checks, recipients may stage historical secrets. An epoch not yet reached by local administration synchronization MUST NOT alone make material invalid. Before activation, verified history MUST confirm that the group has that epoch; restrict the secret to that group and epoch.

Staging secrets advances neither administration head nor event cursor. Synchronizing them grants no permission to read events or key material from the host; those reads still require current membership and device-access checks.
