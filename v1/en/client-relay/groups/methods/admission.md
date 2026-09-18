# Group Admission Methods

[Group Hosting Protocol](../README.md) · [Common Method Conventions](conventions.md)

## `group.invite.create`

A current member creates a targeted or public invitation under the [group invitation policy](../core-objects.md#groupstate).

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/group/invite/create` |
| Session requirement | Device session |
| WSS | `group.invite.create` |
| HTTP success status | `204 No Content` |

### Request Parameters

`GroupInvite` fields:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed to `meshline.group.invite` |
| `invite_id` | string | Yes | Invitation identifier; the issuing device MUST generate a new random 16-byte ID for each new invitation, encoded as `inv_` followed by 22 base64url characters |
| `group_id` | string | Yes | The group the invitation permits an account to apply to join; MUST be hosted by the current relay, and the caller MUST currently be authorized to issue invitations for it |
| `inviter` | string | Yes | Current member account creating and responsible for the invitation; MUST equal both the calling account and the account in the signing device certificate |
| `invitee` | string | No | Account ID permitted to submit an application using this invitation; if present, the invitation is targeted; if omitted, it is public and shareable with multiple accounts |
| `max_uses` | integer | No | Positive use limit for a public invitation; omission means unlimited uses until expiry or revocation. Targeted invitations MUST omit this field and can be successfully used only once |
| `created_at` | integer | Yes | UTC Unix seconds when the issuing device created and signed the invitation; validated against the relay's clock-tolerance policy at acceptance |
| `expires_at` | integer | Yes | UTC Unix seconds when the invitation expires; MUST be later than `created_at`, and `expires_at - created_at` MUST NOT exceed the relay's `max_group_invite_ttl` |
| `device_signature` | string | Yes | Signed by the inviter using the device for this call; the signature input is the complete invitation object excluding this field |

### Response Object

None.

### Processing and Errors

At creation, verify that the group remains active, the caller's current role and the invitation policy allow the requested targeted or public form, `inviter` matches the account in the device session and verification certificate, client timestamps satisfy the tolerance policy, the invitation has not expired, and the signature is valid.

Invalid request structure, IDs, account encodings, `max_uses`, timestamp types or representations, declared validity period, or an already expired invitation return `bad_request`. A `created_at` beyond the relay's permitted clock deviation returns `clock_skew`. An `inviter` differing from the device-session or verification-certificate account, or disallowed membership, role, ban status, or invitation policy, returns `forbidden`. A closed group, an existing invitation ID, or concurrent creation conflict returns `state_conflict`.

On success, persist the complete invitation and the issuing device certificate verified at acceptance, without appending a group event or advancing keys. Later certificate renewal, expiry, or device removal does not change the authorization decision completed when the invitation was accepted. A later reduction of `max_group_invite_ttl` does not change an accepted invitation's `expires_at`.

## `group.invite.resolve`

Queries a group invitation and its current use count by invitation ID.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/group/invite/resolve` |
| Session requirement | Device session |
| WSS | `group.invite.resolve` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group containing the invitation |
| `invite_id` | string | Yes | Invitation ID to query |

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `invite` | [GroupInvite](#groupinvitecreate) | Yes | The complete signed invitation accepted by the relay; `group_id` and `invite_id` MUST match the request |
| `signer_certificate` | DeviceCertificate | Yes | Device certificate used to verify the invitation signature; its account MUST equal the invitation's `inviter` |
| `uses` | integer | Yes | Number of successful uses at query time; MUST be a nonnegative safe integer |

The client MUST verify the signature and identity bindings of `signer_certificate` according to [`DeviceCertificate`](../../core-objects/accounts-and-devices.md#devicecertificate), then use its signing public key to verify the complete invitation.

### Processing and Errors

The caller MUST be a current member who is not banned. The owner and administrators can query all invitations in the group; ordinary members can query only invitations they created. The relay MUST confirm the caller's read permission before returning an invitation record.

A missing or malformed group ID or invitation ID returns `bad_request`. A nonexistent group or invitation, or an exhausted, expired, or revoked invitation, returns `not_found`. A caller who is not a current member, is banned, or lacks read permission for the target invitation receives `forbidden`.

## `group.invite.list`

Lists currently valid group invitations with pagination. The owner and administrators can view invitations across the group; ordinary members can view only invitations they created.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/group/invite/list` |
| Session requirement | Device session |
| WSS | `group.invite.list` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group whose invitation records are to be listed |
| `cursor` | string | No | List cursor returned by the previous page; omit on the first read; see [List Pagination Rules](conventions.md#list-pagination-rules) |
| `limit` | integer | No | Maximum invitations returned in this page; MUST be a positive safe integer, subject to the [pagination conventions](../../methods/conventions.md#pagination) |

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `invites` | array&lt;object&gt; | Yes | This page of invitation records visible to the caller; an empty array when none are visible |
| `certificates` | array&lt;DeviceCertificate&gt; | Yes | Issuing device certificates referenced by this page's `signer_device_id` values; deduplicated by derived device ID |
| `next` | string | No | Provided if records remain in this traversal; see [List Pagination Rules](conventions.md#list-pagination-rules) |

Each `invites` element contains:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `invite` | [GroupInvite](#groupinvitecreate) | Yes | The complete signed invitation accepted by the relay |
| `signer_device_id` | string | Yes | Device ID used to create the invitation; MUST reference an entry in this response's `certificates` |
| `uses` | integer | Yes | Number of successful uses of this invitation; MUST be a nonnegative safe integer |

The client MUST verify each certificate's signature and identity bindings according to [`DeviceCertificate`](../../core-objects/accounts-and-devices.md#devicecertificate) and derive its device ID. Derived IDs MUST NOT repeat, and their set MUST cover all references in this page. The client MUST confirm that the corresponding certificate belongs to the inviter account declared in the invitation and verify the invitation with its signing public key. The order of the `certificates` array has no protocol meaning.

### Processing and Errors

The list excludes exhausted, expired, and revoked invitations within the caller's visible scope.

An invalid request or cursor returns `bad_request`; a nonexistent group or unavailable state required by the cursor returns `not_found`; a caller who is not a current member or is banned receives `forbidden`.

## `group.invite.revoke`

The owner can revoke any invitation; other current members can revoke only invitations they created.

| Item | Convention |
|---|---|
| HTTP | `DELETE /meshline/v1/group/invite/revoke` |
| Session requirement | Device session |
| WSS | `group.invite.revoke` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group containing the invitation to revoke; the caller MUST remain a current member |
| `invite_id` | string | Yes | Invitation ID to revoke; MUST identify an invitation record still stored in that group |

### Response Object

None.

### Processing and Errors

An invalid invitation ID or group ID returns `bad_request`. A nonexistent group or invitation returns `not_found`. A caller who is not a current member, is neither owner nor invitation issuer, or is banned receives `forbidden`. Repeating the call for an already revoked invitation returns `state_conflict`.

Revocation immediately invalidates the invitation and pending applications referencing it. New applications using it MUST NOT be accepted, and associated applications MUST NOT be approved. Already approved members and consumed uses remain unchanged. Neither revocation nor application invalidation enters the timeline. Send `group.application.changed` when the pending application list changes.

## `group.application.submit`

An account that is not a current member submits a join application using a valid invitation.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/group/application/submit` |
| Session requirement | Device session |
| WSS | `group.application.submit` |
| HTTP success status | `204 No Content` |

### Request Parameters

`GroupApplication` fields:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed to `meshline.group.application` |
| `account` | string | Yes | Applicant account; MUST match the account of this device session and the device certificate used for verification |
| `group_id` | string | Yes | The group the applicant wants to join; the caller MUST not yet be a current member |
| `invite_id` | string | Yes | Invitation authorizing this application; when the relay accepts the application, it MUST remain valid, unrevoked, unexhausted, and applicable to the applicant |
| `member_encryption_public_key` | string | Yes | Newly generated 32-byte X25519 public key of the applicant, encoded as unpadded base64url |
| `device_signature` | string | Yes | Signed by the applicant using the device for this call; the signature input is the complete application excluding this field |

### Response Object

None.

### Processing and Errors

The relay identifies the calling account and device through the device session, verifies the signature with that device's certificate, confirms that the application's `account` matches the session and certificate accounts, and verifies that the group remains active, the caller is not yet a member and is not banned, and the invitation exists, is unrevoked and unexpired, has remaining uses, and matches any targeted account. It also validates the member public key.

Invalid request structure, fixed values, account encoding, or public-key encoding return `bad_request`. An applicant account differing from the session or verification-certificate account, a banned caller, or an invitation that is nonexistent, revoked, expired, exhausted, or inapplicable to the caller returns `forbidden`. A closed group, an account that is already a current member, or concurrent replacement conflict returns `state_conflict`.

An account can have at most one pending application per group. While the current application is valid and the call passes all applicable checks, an HTTP or WebSocket retry with identical [Canonical JSON](../../../general.md#canonical-json) for the complete signed application succeeds, retaining the original application, the device certificate saved at acceptance, and `accepted_at`, without changing the list or sending another `group.application.changed`. A valid application with different content replaces that account's previous pending application.

When creating or replacing an application, the relay MUST atomically save the complete application, the device certificate verified at acceptance, and `accepted_at`, and send `group.application.changed` after successful persistence. Submission does not append a group event.

Invitation uses and application validity follow [Invitations, Applications, and Capacity Limits](../concepts/membership-and-access.md#invitations-applications-and-capacity-limits). Banning an applicant also deletes its pending application.

## `group.application.list`

The current owner or an administrator queries pending applications with pagination.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/group/application/list` |
| Session requirement | Device session |
| WSS | `group.application.list` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group whose current pending join applications are to be listed |
| `cursor` | string | No | List cursor returned by the previous page; omit on the first read; see [List Pagination Rules](conventions.md#list-pagination-rules) |
| `limit` | integer | No | Maximum applications returned in this page; MUST be a positive safe integer, subject to the [pagination conventions](../../methods/conventions.md#pagination) |

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `applications` | array&lt;object&gt; | Yes | This page of pending application evidence; an empty array when there are no applications |
| `next` | string | No | Provided if records remain in this traversal; see [List Pagination Rules](conventions.md#list-pagination-rules) |

Each `applications` element contains:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `application` | [GroupApplication](#groupapplicationsubmit) | Yes | The complete signed application saved by the relay |
| `signer_certificate` | DeviceCertificate | Yes | The complete device certificate verified and stored when the relay accepted the application |
| `accepted_at` | integer | Yes | UTC Unix seconds when the relay accepted the current application |

### Processing and Errors

The list excludes applications whose invitations are no longer valid.

An invalid request or cursor returns `bad_request`; a nonexistent group or unavailable state required by the cursor returns `not_found`; a caller without owner or administrator permission, or a banned caller, receives `forbidden`.

## `group.application.approve`

The owner or an administrator atomically approves one or more applications. All new members initially have the `member` role.

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/group/application/approve` |
| Session requirement | Device session |
| WSS | `group.application.approve` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `approval` | GroupApplicationApproval | Yes | The complete batch admission decision signed by an administrator; becomes the approval event's `payload` |
| `client_secret_commitment` | string | Yes | Commitment to the current client group secret used to generate these client-secret boxes, in the `sha256:` textual representation; the relay MUST confirm that it remains the group's current authoritative commitment when approval takes effect |
| `client_secret_boxes` | object&lt;string, GroupSecretBox&gt; | Yes | Client-secret boxes keyed by applicant account; the key set MUST exactly match the accounts listed in the approval object, and each box is constructed using the corresponding application public key and secret commitment |

`GroupApplicationApproval` fields:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed to `meshline.group.application.approval` |
| `group_id` | string | Yes | The group for this batch admission; all approval entries and client-secret boxes MUST belong to it |
| `prev_hash` | string | Yes | Digest of the preceding [management-chain](../core-objects.md#participating-events-and-predecessor-references) entry; MUST still be the current chain head at submission |
| `members` | array&lt;object&gt; | Yes | Member results admitted by this operation; MUST be nonempty, with no duplicate accounts |
| `device_signature` | string | Yes | Signed by the approver using the device for this call; the signature input is the complete approval object excluding this field |

Each `members` element contains:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `account` | string | Yes | Account approved to join the group; the relay uses it to locate that account's current application |
| `member_encryption_public_key` | string | Yes | The 32-byte X25519 public key the member will use after joining; MUST equal the public key in its current application |

The approver uses `signer_certificate` to verify the certificate and complete application signature, confirms that `application.account` matches the certificate account, and checks the group, invitation, and member public key in the application. A targeted invitation's `invitee` MUST match that account. Approval entries use the account and public key from the verified request, and key boxes use that account and public key. Secrets may be sealed only after all checks pass. Key boxes are constructed and validated according to [Client-Secret Boxes](../concepts/model-and-keys.md#client-secret-boxes).

### Response Object

None.

### Processing and Errors

The relay MUST confirm that the supplied client-secret commitment remains the group's current authoritative commitment. For each account in the approval object, it obtains the current application, confirms that the target account, the application's `account`, and the application device certificate's account match, and checks that the member encryption public key matches the current application. The relay MUST verify the stored application device certificate and complete application signature, locate the current invitation using the application's `invite_id`, and check its validity period, revocation status, applicable account, and remaining uses. Invitation issuance permission retains the authorization decision completed at invitation creation.

Invalid fixed values, group ID, accounts, member encryption public keys, client-secret commitment representation, key-box account set, or box encoding structure, an empty batch, or duplicate accounts return `bad_request`. A caller without approval permission or a banned caller receives `forbidden`. A nonexistent group or missing current application for any account returns `not_found`. A closed group, an outer client-secret commitment that is no longer current, insufficient capacity, a signed member public key differing from the current application, an account that has already joined or is banned, an invitation that has expired, been revoked, or run out of uses, or concurrent submission conflict returns `state_conflict`.

Resubmitting the same approval request after passing permission checks returns `state_conflict` if it references an old chain head. If it is re-signed against the current chain head but the target no longer has a current application, return `not_found`.

The relay atomically consumes invitation uses, deletes applications, adds members, establishes access intervals for application devices, generates a new relay secret, advances `epoch` once, and appends one event. On approval, it writes the approved accounts and public keys into internal member state and permanently retains the approval event and the approver's device certificate. Other clients reconstruct membership state from the results signed by the approver.

After a successful commit, send `group.timeline.changed` and `group.application.changed` to signal the changed pending application list.

## `group.application.reject`

The owner or an administrator rejects one or more join applications.

| Item | Convention |
|---|---|
| HTTP | `DELETE /meshline/v1/group/application/reject` |
| Session requirement | Device session |
| WSS | `group.application.reject` |
| HTTP success status | `204 No Content` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `group_id` | string | Yes | The group containing the join applications |
| `accounts` | array&lt;string&gt; | Yes | Account IDs whose current join applications are to be rejected; MUST be nonempty and contain no duplicates |

### Response Object

None.

### Processing and Errors

Invalid request fields or account formats, an empty array, or duplicate accounts return `bad_request`. A nonexistent group or missing current application for any target account returns `not_found`. A caller without owner or administrator permission, or a banned caller, receives `forbidden`. If any record is concurrently replaced or processed after the relay reads this batch of current applications and before it commits the operation, return `state_conflict`.

Once all checks pass, atomically delete all target accounts' current pending applications as of the operation's effective time, without consuming invitation uses or appending a group event, and send `group.application.changed` after commit. If any check fails, the entire batch has no effect.
