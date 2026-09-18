# Common Group Method Conventions

[Group hosting protocol](../README.md)

## Write Request Rules

Unless a method states otherwise, `device_signature` is the calling device's network-bound Ed25519 signature over the complete object excluding that field. Relays MUST confirm through the device session that the signer is the calling device and belongs to the calling account.

Member public keys are protected by their containing object's device signature. Verifiers MUST check both certificate signatures, account-ID derivation, expected account binding, and business-request signature.

Complete group write parameters MUST have [Canonical JSON](../../../general.md#canonical-json) UTF-8 encoding no larger than 1 MiB (1,048,576 bytes). Batch methods have no separate fixed item count but remain subject to this size, group capacity, and corresponding list constraints.

## Validation and Error Handling Rules

### Required Checks

A method's required checks include all applicable items below:

- Transport size, JSON structure, fixed values, and field representations.
- Device session and clock tolerance.
- Certificates and business signatures, account binding, group hosting, member access, roles, and bans.
- Applicable `prev_hash`.
- Current membership, invitations, applications, member resets, access intervals, epochs, capacity, and other business state.
- Box account coverage, encoding structure, and consistency of signed commitments with current state.

Only after all required checks pass may results take effect under [Atomic commit and persistence rules](#atomic-commit-and-persistence-rules). Read results must also satisfy access conditions.

### Error Selection and Mapping

For multiple failures, any applicable error may be returned unless the method or [Administration chain](../core-objects.md#relay-commit-and-concurrency-control) specifies priority. Priority constrains response selection, not checking order. Error responses MUST NOT disclose protected group information to callers lacking access; this applies to code, `message`, and `data`.

All group methods use [Common errors and HTTP/JSON-RPC mapping](../../methods/conventions.md#error-codes):

- Invalid parameter structure, representation, value, or page position: `bad_request`.
- Method-required client creation time failing clock tolerance: `clock_skew`. Invalid type/representation still uses `bad_request`; invitation, pending-record, and key-material expiry follows each method.
- Parsed complete request or method-limited complete object over byte limit: `request_too_large`. Invalid individual-field format, encoded length, or value still uses `bad_request`. Oversized raw WebSocket messages close under transport rules.
- Absent, expired, or revoked session, or missing/malformed HTTP token: `unauthorized`.
- Declared calling account inconsistent with session or certificate, insufficient valid-session mode, membership, role, invitation authorization, or access interval, or a banned caller: `forbidden`.
- Invalid cryptographic request, object, or certificate signature: `invalid_signature`. Valid signatures with no current device authority follow common session/device rules, not signature errors.
- Missing or unavailable target group, record, or cursor-dependent state: `not_found`.
- Changed business preconditions, writing with an old epoch, or writing to a closed group: `state_conflict`.

## Atomic Commit and Persistence Rules

When a write produces events or state changes, required request evidence, group state or pending lists, keys, access intervals, and events MUST activate atomically as a complete consistent result. Permissions, revisions, referenced records, validity periods, and other preconditions MUST still hold at activation. Failure MUST NOT leave partial effects, including changes to sequence, `epoch`, invitation uses, or part of a batch.

Changed referenced list records return `state_conflict` or `not_found` as the method specifies; clients reread as needed.

Before success or notification, the relay MUST persist required results, which remain complete and consistent after restart/recovery. Notification failure does not roll back activated state.

Except creation, [administration-chain](../core-objects.md#relay-commit-and-concurrency-control) requests also follow common `prev_hash`, concurrency, and atomicity rules. Malformed hashes return `bad_request`; old heads return `state_conflict`.

## List Pagination Rules

`limit` and actual page size follow [Pagination](../../methods/conventions.md#pagination); reducing page size does not alter cursor semantics below.

### Cursor Format and Binding

If present, `cursor` and `next` MUST be nonempty, case-sensitive strings matching `^[A-Za-z0-9._~-]+$`. Internal format is relay-defined.

Cursors bind at least group, list type, caller-visible scope, and traversal position. Clients MUST NOT parse, modify, or reuse them across methods, or infer chronology, priority, or processing order from cursor or record order. Invalid `limit`, cursor encoding, or position returns `bad_request`; unavailable cursor-dependent state returns `not_found`, allowing a restart without `cursor`.

### Traversal and Refresh

Omit `cursor` initially, then follow `next`. List order has no business semantics. While the list and caller-visible scope are unchanged and the cursor remains usable, traversal order MUST be stable and complete traversal MUST retrieve every in-scope record without duplicates or omissions.

Presence of `next` requires at least one record on the page; omission ends traversal.

If lists change during pagination, clients may restart without `cursor` to refresh. List results do not replace current-state checks at submission.

Before every page, the relay MUST check caller access against current group state. If permissions no longer cover the cursor-bound scope, return `forbidden`; the caller may restart without `cursor` under current permissions. If permissions still cover the original scope, the original cursor remains usable.
