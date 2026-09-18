# Member Key Recovery Methods

[Group Hosting Protocol](../README.md) · [Common Method Conventions](conventions.md)

## `group.member.recovery.submit`

A current member uses a valid device to request member key recovery, replacing its own member encryption public key. The request does not change group state and awaits approval for a limited period.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/group/member/recovery/submit` |
| Session requirement | Device session |
| WSS | `group.member.recovery.submit` |
| HTTP success status | `200 OK` |

### Request Parameters

`GroupMemberRecoveryRequest` fields:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed to `meshline.group.member.recovery` |
| `account` | string | Yes | Account requesting replacement of its member public key; MUST match the account of this device session and the device certificate used for verification |
| `group_id` | string | Yes | The group in which the current member requests replacement of its member encryption public key |
| `member_encryption_public_key` | string | Yes | New 32-byte X25519 public key, encoded as unpadded base64url; MUST differ from the current member public key |
| `device_signature` | string | Yes | Signed by the member requesting key recovery using the device for this call; the signature input is the complete request excluding this field |

Clients are advised to save the complete request and candidate private key before submission so processing can resume after interruption. Candidate material does not overwrite current private state. When replacing a request, the client MUST retain the private key corresponding to the new request's public key.

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `accepted_at` | integer | Yes | UTC Unix seconds when the relay accepted the current request |
| `expires_at` | integer | Yes | UTC Unix seconds when the current request expires; MUST be later than `accepted_at` |

### Processing and Errors

The relay uses the calling device's certificate to verify the complete request signature and confirms that the request's `account` matches the session and certificate accounts.

Invalid request structure, fixed values, account or public-key encoding, or a new public key identical to the current member public key, returns `bad_request`. A nonexistent group returns `not_found`. A request account that differs from the session or verification-certificate account, or a caller who is not a current member or is banned, receives `forbidden`. A concurrent change in member state returns `state_conflict`.

At most one key recovery request is retained per current member account in each group. While the current request is valid and the call passes all applicable checks, an HTTP or WebSocket retry with identical [Canonical JSON](../../../general.md#canonical-json) for the complete signed request succeeds without refreshing acceptance or expiry times or sending another notification. A valid request with different content replaces the previous unprocessed request.

When creating or replacing a request, the relay atomically stores the current request, the device certificate used to verify its signature, `accepted_at`, and `expires_at`. The relay determines this finite waiting period at acceptance. Subsequent configuration changes and identical retries MUST NOT change the stored expiry. After successful persistence, it sends `group.member.recovery.changed`.

Submission, replacement, withdrawal, and expiry do not change the current member public key. Replacement does not retain the old request or change access intervals, the timeline, or the key version. When a member leaves, is removed, or has its request approved, the relay MUST delete its current request.

## `group.member.recovery.list`

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/group/member/recovery/list` |
| Session requirement | Device session |
| WSS | `group.member.recovery.list` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group whose pending member key recovery requests are to be read |
| `cursor` | string | No | List cursor returned by the previous page; omit on the first read; see [List Pagination Rules](conventions.md#list-pagination-rules) |
| `limit` | integer | No | Maximum requests returned in this page; MUST be a positive safe integer, subject to the [pagination conventions](../../methods/conventions.md#pagination) |

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `requests` | array&lt;object&gt; | Yes | This page of pending requests visible to the caller; an empty array when none are visible |
| `next` | string | No | Provided if records remain in this traversal; see [List Pagination Rules](conventions.md#list-pagination-rules) |

Each `requests` element contains:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `request` | [GroupMemberRecoveryRequest](#groupmemberrecoverysubmit) | Yes | The complete signed member key recovery request stored by the relay |
| `signer_certificate` | DeviceCertificate | Yes | The complete device certificate verified and stored when the relay accepted the request |
| `accepted_at` | integer | Yes | UTC Unix seconds when the relay accepted the current request |
| `expires_at` | integer | Yes | UTC Unix seconds when the current request expires; MUST be later than `accepted_at`; after this time, the request MUST NOT be approved, rejected, or withdrawn |

The client MUST validate each record's `signer_certificate` according to the signature and identity rules of [`DeviceCertificate`](../../core-objects/accounts-and-devices.md#devicecertificate), use it to verify the network-bound signature of `request`, and confirm that `request.account` matches the certificate account. The certificate establishes only the signing identity used when the relay accepted the request. The client does not reconsider whether this historical request may be listed based on the certificate's current validity. At approval or rejection, the relay rechecks the current request, membership state, and calling permissions.

### Processing and Errors

The owner can see all current requests. An administrator can see ordinary members' requests and its own request. An ordinary member sees only its own request. An ordinary member's result contains at most one item and therefore MUST NOT include `next`.

The list contains only unexpired requests visible to the caller.

An invalid request or cursor returns `bad_request`. A nonexistent group or unavailable state required by the cursor returns `not_found`. A caller who is not a current member or is banned receives `forbidden`.

When a locally saved request is no longer listed, the client synchronizes and verifies the management chain and reconstructs the current member public key from approval results. A candidate private key may be activated only if all of the following hold:

1. An approval event exists whose account and new public key both match the candidate.
2. Current member state still uses that public key.
3. The client-secret box matches the verified current commitment.

Approval management events and their verification certificates are retained permanently. If they are missing locally, retrieve the management history; a public key reported by the relay cannot replace approval verification.

Discard the candidate if the request was replaced, rejected, or expired without a corresponding approval.

If key-box verification fails, the candidate private key MUST NOT be activated. The member may submit a new key recovery request.

## `group.member.recovery.approve`

Approves one or more current member key recovery requests. The owner or an administrator supplies a client-secret box for each target member.

The owner can approve any current member, including itself. An administrator can approve only ordinary members and cannot approve its own request.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/group/member/recovery/approve` |
| Session requirement | Device session |
| WSS | `group.member.recovery.approve` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `approval` | GroupMemberRecoveryApproval | Yes | The complete batch approval decision signed by a member authorized to approve the target requests; becomes the approval event's `payload` |
| `client_secret_commitment` | string | Yes | Commitment to the current client group secret used to generate these client-secret boxes, in the `sha256:` textual representation; the relay MUST confirm that it remains the group's current authoritative commitment when approval takes effect |
| `client_secret_boxes` | object&lt;string, GroupSecretBox&gt; | Yes | Client-secret boxes keyed by target account; the key set MUST exactly match the accounts listed in the approval object, and each box is constructed using the new member public key in the corresponding current request |

`GroupMemberRecoveryApproval` fields:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed to `meshline.group.member.recovery.approval` |
| `group_id` | string | Yes | The group for this member key recovery; all approval results and client-secret boxes MUST belong to it |
| `prev_hash` | string | Yes | Digest of the preceding [management-chain](../core-objects.md#participating-events-and-predecessor-references) entry; MUST still be the current chain head at submission |
| `members` | array&lt;object&gt; | Yes | Member key recovery results approved in this operation; MUST be nonempty, with no duplicate accounts |
| `device_signature` | string | Yes | Signed by the approver using the device for this call; the signature input is the complete approval object excluding this field |

Each `members` element contains:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `account` | string | Yes | Current member account whose member encryption public key is to be replaced; the relay uses it to locate the account's current request |
| `member_encryption_public_key` | string | Yes | The approved 32-byte X25519 public key, encoded as unpadded base64url; MUST equal the new member public key in that account's current request |

The approver MUST obtain and individually verify requests according to [`group.member.recovery.list`](#groupmemberrecoverylist), confirm that each request's `account` is the target member and that the approver has permission, and then use the request's `member_encryption_public_key` to seal the secret according to [Client-Secret Boxes](../concepts/model-and-keys.md#client-secret-boxes).

### Response Object

None.

### Processing and Errors

For each target account, the relay retrieves the current pending request at the time the operation takes effect, confirms that the target account, the request's `account`, and the request device certificate's account match, and accepts the batch only if every approval result matches its corresponding request.

Invalid fixed values, group ID, accounts, account set, new member public keys, commitment representation, or box encoding structure, an empty batch, or duplicate accounts return `bad_request`. A caller without approval permission, a banned caller, or an administrator attempting to approve a non-ordinary member or its own request receives `forbidden`. A nonexistent group, a missing current request for any account, or an expired request returns `not_found`. A closed group, a new member public key that differs from the current request, a supplied commitment that is no longer the group's current authoritative commitment, a target that is no longer a current member, or concurrent state changes return `state_conflict`.

The relay MUST first validate the entire batch of requests, certificates, approval permissions, membership state, client-secret commitment, and box encodings. It then atomically replaces all target member public keys, closes their old device access intervals, allows the devices recorded when it accepted the corresponding requests to access the group starting at this event, saves their client-secret boxes, deletes all approved requests, generates one new relay secret, advances `epoch` once, and appends one event containing the complete `GroupMemberRecoveryApproval`. If a client-secret rotation preparation exists, the same atomic commit MUST delete staged boxes for all target members in this batch according to [`group.secret.rotation.prepare`](keys.md#groupsecretrotationprepare), preserving all other boxes and the original expiry.

After successfully persisting the related state, the relay sends one `group.timeline.changed` and sends `group.member.recovery.changed` to signal changes to the affected requests.

## `group.member.recovery.reject`

Deletes one or more current pending member key recovery requests in the same group. Permission is evaluated per item: a request belonging to the caller is withdrawn; the owner can reject other members' requests, while an administrator can reject only requests from other ordinary members.

| Item | Convention |
|---|---|
| HTTP | `DELETE /meshline/v1/group/member/recovery/reject` |
| Session requirement | Device session |
| WSS | `group.member.recovery.reject` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group containing the member key recovery requests |
| `accounts` | array&lt;string&gt; | Yes | Account IDs whose current member key recovery requests are to be withdrawn or rejected; MUST be nonempty and contain no duplicates |

### Response Object

None.

### Processing and Errors

Invalid request fields or account formats, an empty array, or duplicate accounts return `bad_request`. A nonexistent group, a missing current request for any target account, or any expired request returns `not_found`. A caller who is not a current member or is banned, or any target request the caller lacks permission to withdraw or reject, results in `forbidden`. If any record is concurrently replaced or processed after the relay reads this batch of current requests and before it commits the operation, the relay returns `state_conflict`.

Once all checks pass, the relay atomically deletes all target accounts' pending records without changing members, public keys, access intervals, keys, or the timeline. If any check fails, the entire batch has no effect. After commit, the relay sends `group.member.recovery.changed`. Members may later submit new valid requests directly.
