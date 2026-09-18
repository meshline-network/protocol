# Group Key Methods

[Group Hosting Protocol](../README.md) · [Group Model and Keys](../concepts/model-and-keys.md) · [Common Method Conventions](conventions.md)

## `group.key.sync`

`group.key.sync` returns retained group key material within the current device's access intervals.

Clients call this method for the required group and `epoch` values to retrieve missing local material. Material that has not completed verification MUST NOT be activated early.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/group/key/sync` |
| Session requirement | Device session |
| WSS | `group.key.sync` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group whose key material is to be synchronized; all response key entries MUST belong to this group and the calling account |
| `after` | integer | No | Lower key-version bound for this read; defaults to `-1`, MUST be at least `-1` and no greater than the group's current key version. Only entries strictly greater than this value and within access intervals are returned |
| `limit` | integer | No | Maximum key entries returned in this page; MUST be a positive safe integer, subject to the [pagination conventions](../../methods/conventions.md#pagination) |

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `keys` | array&lt;GroupKeyEntry&gt; | Yes | The earliest page of key entries within the current device's access intervals, strictly beyond the requested version and still retained by the relay; strictly increasing by `epoch`, possibly empty, with no requirement for consecutive versions |
| `has_more` | boolean | Yes | Whether, when the relay generates this page, further retained entries readable by the current device have versions greater than this page's last item; MUST be `false` for an empty page |

`GroupKeyEntry` fields:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `epoch` | integer | Yes | Key version to which this material belongs |
| `client_secret_box` | GroupSecretBox | Conditional | Box sealing this version's client secret to the calling account; historical entries return the original box for that version, without resealing after member public-key changes. MUST be present in the first entry of every page, and in later entries whenever the client-secret commitment or target member public key differs from the preceding returned entry in this page; omitted when both are unchanged |
| `relay_secret_box` | GroupSecretBox | Yes | Box in which the relay seals this version's relay secret to the calling device's encryption public key; see [Relay-Secret Boxes](../concepts/model-and-keys.md#relay-secret-boxes) |

For each `epoch`, the client obtains that version's member public key and client-secret commitment from verified management history to evaluate client-secret-box omission, reconstruct its AAD, and derive the group application secret. The target member public key and commitment are determined by that historical version. Omission compares adjacent returned entries within this page, without requiring consecutive `epoch` values and without reusing omission conditions across pages.

The client MUST check box presence under the same rules. An unchanged commitment does not permit accepting a missing box at a member public-key change. After opening the client secret with the member private key corresponding to the box, the client MUST recompute its commitment and compare it with the commitment for that version in verified management history. Later entries omitting a client-secret box reuse the verified client secret with the same commitment.

After opening both secrets, the client derives the group application secret. A missing old member private key prevents opening the corresponding historical client-secret box but does not prevent reading and independently verifying later entries. Secrets that fail applicable provenance, key-box, or commitment checks MUST NOT be used for key derivation.

### Processing and Errors

The relay MUST validate parameters, the device session, and current membership. Establishment and starting points of device access intervals follow [Device Access Intervals](../concepts/membership-and-access.md#device-access-intervals). Establishing an access starting point and returning key material are effects of a successful call; failed parameter or authorization checks MUST NOT create a new interval.

The relay selects only retained versions within access intervals and paginates in ascending `epoch` order. Nonconsecutive version numbers or a request position referring to a pruned or never-assigned version are not errors; synchronization continues at the next readable material after that position. The current version and the key material needed to recover it MUST remain retained and readable according to [Group Data Retention and Access Rules](../concepts/timeline-and-sync.md#group-data-retention-and-access-rules).

Invalid parameters or an `after` beyond the group's current key version return `bad_request`. A nonexistent group returns `not_found`. An account that is not a current member, is banned, or whose relevant access interval closes during the read receives `forbidden`.

Key synchronization neither advances the key version nor appends a group event. Relay-secret rotation after device invalidation follows [Device Access Intervals](../concepts/membership-and-access.md#device-access-intervals).

## `group.secret.rotation.prepare`

The current owner uses a device session to fix this rotation's parameters and upload client-secret boxes in batches covering all current members. Preparation supplies material without submitting a signed rotation declaration. Final authorization comes from the signed [`group.secret.rotation.commit`](#groupsecretrotationcommit) request.

| Item | Convention |
|---|---|
| HTTP | `PATCH /meshline/v1/group/secret/rotation/prepare` |
| Session requirement | Device session |
| WSS | `group.secret.rotation.prepare` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group for which client group secret rotation is being prepared |
| `base_commitment` | string | Yes | Client-secret commitment on which the preparation is based, using the `sha256:` textual representation; MUST equal the group's current commitment |
| `client_secret_commitment` | string | Yes | Network-bound SHA-256 commitment to the new 32-byte client group secret, using the `sha256:` textual representation; MUST differ from the old commitment and match the plaintext of all boxes in this rotation |
| `client_secret_boxes` | object&lt;string, GroupSecretBox&gt; | Yes | This batch of client-secret boxes to stage, keyed by account and containing at least one entry; accounts MUST be current members, and each box seals the new client secret for this rotation; target public-key rules follow below |

Across batches of the same rotation, all parameters in the table except `client_secret_boxes` MUST remain identical.

For every new rotation, the owner MUST generate a fresh 32-byte client group secret using a cryptographically secure random source and compute its new commitment according to [Client-Secret Commitments](../concepts/model-and-keys.md#client-and-relay-secrets). Restarting preparation after staging expiry or changing fixed rotation parameters also requires a new secret, a new commitment, and regenerated key boxes. Normal batch uploads, additional boxes for new members, and retries continue to reuse the original secret and commitment.

The client first synchronizes and verifies the management chain and seals key boxes using accounts and public keys from local member state. Additional boxes for members added or whose keys changed during preparation require prior verification of the corresponding approval events. If the management chain is missing or signatures or authorization are invalid, secrets MUST NOT be sealed or uploaded to unverified public keys.

If the owner plans to replace its own member public key at commit, it MUST select the new key pair before generating its own box and seal that box to the new public key. The new public key is submitted only in commit's `owner_encryption_public_key`, protected by the complete rotation request signature. Other members use their locally verified current public keys.

Before the first prepare request, clients are advised to save the new `client_group_secret`, this rotation's fixed request parameters, and any new owner member private key, so processing can resume after interruption. Retries should reuse generated boxes, but may reseal the same secret with fresh cryptographically secure randomness. The secret and target context must still satisfy this rotation's requirements.

Candidate values MUST NOT overwrite locally usable current secrets and member private keys. Verification and activation of candidate state MUST follow [`group.secret.rotation.commit`](#groupsecretrotationcommit).

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `prepared` | integer | Yes | Number of distinct current member accounts for which client-secret boxes with valid encoding structure have been saved; does not mean the relay has verified their ciphertext or plaintext |
| `expires_at` | integer | Yes | Expiry in UTC Unix seconds determined when this staged rotation is created or replaced; remains unchanged for the same staged rotation, which cannot be committed at or after expiry |

### Processing and Errors

#### Staged Rotations and Batch Processing

The relay distinguishes staged rotations by the requested group and the client-secret commitment to be activated.

The relay confirms through the device session that the caller is the current owner and that the old commitment underlying the rotation remains the group's current authoritative commitment. It then validates the complete request size, checks that the box map is nonempty and all accounts are current members, and checks boxes according to [Client-Secret Boxes](../concepts/model-and-keys.md#client-secret-boxes). Continuing the current staged rotation also requires that the preparation remain valid.

If no staged record exists, the relay creates a staged rotation directly. If the request's new commitment differs from the one in the current staged rotation and the request passes validation, the relay atomically replaces the existing staged rotation. Creation or replacement fixes the calling account and the old and new client-secret commitments, determines a new `expires_at`, starts preparation with current member accounts and public keys, and saves this batch's boxes without inheriting boxes from the previous rotation. Failed validation or replacement leaves the original staged rotation unchanged.

If the request's new commitment matches the current staged rotation's new commitment, the relay confirms that the other fixed parameters match the first request, then saves this batch's boxes by account. A later accepted box for an account replaces its previous box; boxes for accounts absent from this batch remain unchanged. The entire batch takes effect atomically after validation; failure preserves the original staged material.

#### Membership and Public-Key Changes

New members added during preparation do not invalidate it, and existing members' boxes remain valid. Additional boxes must be supplied using the new members' accounts and public keys.

A member leaving through [`group.member.leave`](members-and-bans.md#groupmemberleave), being removed through [`group.member.remove`](members-and-bans.md#groupmemberremove), or being removed by a [`group.member.ban`](members-and-bans.md#groupmemberban) does not invalidate preparation. The relay MUST atomically delete those accounts' staged boxes when the membership change takes effect. Other members' boxes and the fixed rotation parameters remain unchanged, and the candidate secret and commitment continue to be used. These membership changes do not restore preparation that has expired or become invalid for another reason. See [Security Boundaries of Client-Secret Rotation](../concepts/model-and-keys.md#security-boundaries).

Uploaded batches MUST still contain only accounts that are current members when the operation takes effect. A late or retried batch containing an account that is no longer a current member returns `bad_request` for the entire batch; it MUST NOT restore that account's staged box or invalidate an otherwise valid preparation. After synchronizing and verifying membership changes, the client may remove boxes for former members and continue uploading nonempty batches. An account rejoining does not restore its old staged box; a new box must use its newly approved public key.

When a member public key changes during preparation, the relay MUST atomically delete the affected member's staged box when the public-key change takes effect. Other members' boxes, the fixed parameters, and the original expiry remain unchanged. After synchronizing and verifying the relevant management event, the owner reseals the same candidate secret to the new public key and uploads only the affected member's replacement box. The owner's own box remains subject to the optional key-replacement-at-commit rules above. Public-key changes do not restore preparation that has expired or become invalid for another reason.

After confirming a target public-key change, the client MUST stop uploading and retrying that account's old box. If a recipient finds decryption or commitment verification has failed after commit, it MUST reject the box and may initiate new member key recovery through [`group.member.recovery.submit`](member-recovery.md#groupmemberrecoverysubmit).

#### Errors and State Effects

Invalid request format, group ID, commitments, box accounts, or encoding structure return `bad_request`. A nonexistent group returns `not_found`. A caller who is not the current owner or is banned receives `forbidden`. A closed group, an old commitment that is no longer current, inconsistent fixed parameters when continuing the current staged rotation, an expired staged record, or concurrent write conflict returns `state_conflict`.

Preparation only persists candidate material. It does not update current member public keys, the client-secret commitment, `epoch`, the timeline, or device access intervals, and sends no group event notification.

## `group.secret.rotation.commit`

The current owner submits a signed `GroupClientSecretRotation` to authorize activation of the fully prepared client secret. On success, the declaration is written into a group event.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/group/secret/rotation/commit` |
| Session requirement | Device session |
| WSS | `group.secret.rotation.commit` |
| HTTP success status | `204 No Content` |

### Request Parameters

The request parameters are directly the `GroupClientSecretRotation`; no client-secret boxes are uploaded again.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed to `meshline.group.secret.rotation` |
| `group_id` | string | Yes | The group in which to activate the staged client secret and write the rotation event |
| `prev_hash` | string | Yes | Digest of the preceding [management-chain](../core-objects.md#participating-events-and-predecessor-references) entry; MUST still be the current chain head at submission |
| `client_secret_commitment` | string | Yes | New client group secret commitment to activate, using the `sha256:` textual representation; MUST equal the new commitment fixed during preparation and match the plaintext of all staged client-secret boxes |
| `owner_encryption_public_key` | string | No | Owner's new 32-byte X25519 public key, encoded as unpadded base64url; if supplied, MUST differ from the current member public key and match the target of the owner's uploaded box; omission retains the original public key |
| `device_signature` | string | Yes | Signed by the current owner using the device for this call; the signature input is the complete `GroupClientSecretRotation` excluding this field |

When replacing its own public key, the owner MUST supply the previously selected public key used to generate its own box as `owner_encryption_public_key` and possess the corresponding private key. The public key used at commit MUST match the target of the uploaded owner box. While preparation remains valid, the owner may select a different new public key to activate at this commit, but MUST first reseal its own box to that key and overwrite the previous box through prepare; other members' boxes remain unchanged. Changing the commitment requires a new secret and commitment, replacement of the staged rotation through a new prepare request, and re-uploading boxes.

### Response Object

None.

### Processing and Errors

#### Commit Validation and Errors

The relay MUST validate the complete request size and the formats of fixed fields, group ID, commitment, and optional new member public key, confirm through the device session that the caller is the current owner, and verify that the declaration is signed by the device used for this call. The declared client-secret commitment MUST match the group's current staged rotation, and the caller MUST still be the owner who established it. Ownership transfer deletes the previous owner's staged rotation according to [`group.owner.transfer`](properties-and-roles.md#groupownertransfer).

The relay MUST confirm that the staged record has not expired when the operation takes effect, the old commitment fixed in the preparation remains the group's current authoritative commitment, and the boxes cover all current members at commit time. The rotation declaration's signature does not replace recipient members' validation of key boxes; see [Client-Secret Boxes](../concepts/model-and-keys.md#client-secret-boxes).

Messages, role updates, member departures, member removals, member public-key changes, bans, unbans, and relay-secret-only rotations do not invalidate preparation. If boxes do not yet cover all current members after additions or public-key changes, commit returns `state_conflict` and the original preparation remains valid. To continue rotation after membership changes, the client synchronizes and verifies the new management events, fills missing boxes for the current membership using the same secret, and re-signs against the new chain head before submitting.

Invalid fixed fields, group ID, commitment, public key, or request format, or an `owner_encryption_public_key` identical to the current member public key, returns `bad_request`. A nonexistent group returns `not_found`. An account that is not the current owner or is banned receives `forbidden`. A closed group, a missing or expired staged rotation, a new commitment that differs from the staged record, a staged old commitment that is no longer current, incomplete member coverage, or concurrent state changes return `state_conflict`.

#### Atomic Commit and Notifications

The relay MUST atomically activate the new client commitment and optional new owner public key, save every member's client-secret box, generate a new relay secret, advance `epoch`, delete the staged record, and append an event whose body is this signed declaration. If the owner's member public key is also replaced, the same operation MUST delete any pending key recovery request for the owner. Other unexpired key recovery requests remain and may be approved against the new commitment.

After successful commit, send `group.timeline.changed`. If the operation actually deleted a pending owner key recovery request, also send `group.member.recovery.changed` according to the [recipient scope for deletion notifications](../notifications/README.md#groupmemberrecoverychanged).

Failure MUST NOT partially activate the candidate secret or delete a staged record that can still be committed.

#### Client Verification and Activation

Before activating candidate state, the client MUST use `group.sync` to verify a rotation event matching its locally signed request, the management chain, and owner authorization, then validate key entries and boxes through `group.key.sync`. If a later rotation has superseded this event, obsolete candidate values cannot be activated. Local candidate state may be activated only while the candidate public key and commitment still match the locally reconstructed current state.

If the owner member private key was also replaced, synchronize the activated private key through [`AccountGroupPrivateStateSync`](../concepts/account-sync.md#accountgroupprivatestatesync). Other devices obtain group secrets from the corresponding key boxes.
