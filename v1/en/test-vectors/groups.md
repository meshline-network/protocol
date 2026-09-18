# Group Test Vector Execution Guide

[Normative test vectors](README.md) · [Common execution rules](README.md#common-execution-rules)

## Coverage

File: [`groups-v1.json`](../../test-vectors/groups-v1.json). Sections: `group_id`, `keying`, `management_chain`, and `encrypted_nicknames`. Interpret each section's group ID using that section's own inputs.

| Section | Execution entry points |
|---|---|
| `group_id`, `keying` | [Group IDs and cryptography](#group-ids-and-cryptography) |
| `management_chain` | [Administration chain](#administration-chain), [Certificate and account binding](#certificate-and-account-binding), [Concurrency, state changes, and visibility](#concurrency-state-changes-and-visibility) |
| `encrypted_nicknames` | [Encrypted nicknames and local state](#encrypted-nicknames-and-local-state) |

## Fixed Inputs and References

### Administration Chain Inputs

`management_chain` supplies certificates for three test accounts, application and reset requests directly carrying `account` and public keys, 15 signed administration chain events covering 12 operation types, exact signing and hashing inputs, per-event member projections, and synchronization responses. `chain` is ordered along the group timeline and also includes one encrypted nickname message that does not participate in the administration chain, for 16 items in total.

This set uses its own `group_id` and accounts, not `keying.input`. Account signatures on certificates follow RFC 6979.

### Nickname Messages and Branch Starting Points

`encrypted_nicknames` supplies encrypted nickname messages, local nickname state assertions, and display-name examples. `epoch_inputs` gives the `client_group_secret`, `relay_epoch_secret`, and derivation results for each key epoch; select by epoch.

`messages` starts independently from the administration state at `starting_event_index`, providing exact plaintext bytes, AAD, the derived 32-byte `message_key`, fixed test input `message_nonce`, envelope signing input, and a complete message event.

`main_chain_nickname` also appears in `management_chain.chain[14]`. Other messages belong to independent branches and are not appended after the complete main chain. Ordinary chat cryptographic vectors in `keying` remain independent.

A message's `actor` uses the test keys in `management_chain.actors`. `A2` uses A's signing key specified by `additional_device`, the `same_account` certificate in `management_chain.signer_account_binding.cases`, and the device ID derived from that certificate. The two devices belong to the same account but have different device identities.

Event indexes in this topic are zero-based. Cases associated by name, account label, or event index retain their respective rules; these associations are not expanded as JSON Pointers.

## Execution Steps and Assertions

### Group IDs and Cryptography

`group_id` reconstructs Canonical JSON and SHA-256 from the supplied network context and ID inputs, then takes the first 16 digest bytes and adds the `grp_` prefix. Compare every intermediate value and the final ID.

Commitments, boxes, group application secrets, group message contexts, and ciphertext in `keying` are exact protocol bytes. Implementations MUST verify binding to the network, group, account, member public key, device, key epoch, and sender context.

All group message vectors use `payload: { alg, nonce, ciphertext }` inside the envelope, with algorithm `AES-256-GCM`. `keying.input.message_nonce` and the `message_nonce` in each message case are fixed random inputs for reproducing deterministic ciphertext and signatures; they do not come from HKDF output.

Only 32 bytes are derived for the message key; compare against `keying.expected.message_key` or the case's `message_key`, respectively. The wire nonce comes from `payload.nonce`. All ordinary chat, nickname, and attachment-reference messages use this construction.

### Administration Chain

#### Event Chain and Digests

A creation body carries no `prev_hash`; subsequent administration bodies reference the previous administration event's digest. The creation event can only be the chain's starting point. The administration digest directly uses the complete `payload`, including its body signature and unknown properties, and uses the protocol-wide `sha256:` plus base64url representation.

An encrypted nickname message envelope carries no `prev_hash`. The vectors provide its exact envelope signing input and `management_head_hash_before_and_after`, but no administration digest for that event. Its `expected_projection.head` stays unchanged; the subsequent closure event directly references the preceding administration event.

The body of `automatic_rotation` contains only `$type`; its group comes from the synchronization context and its key epoch from the outer event. It does not advance the administration chain.

`hash_metadata_exclusion` verifies that the outer device reference, sequence number, reception time, and key epoch do not change the administration digest. An identical hash does not waive certificate, signature, permission, or other field checks.

The group-creation owner, join applications, and approval entries carry no `nickname`. Administration member projections do not store nicknames; decrypted nickname updates change only the recipient's local display.

Other clients adopt an approval result after verifying the approver and prior permissions. Approval events do not attach the applicant's certificate or a separate public-key declaration.

#### Rejection Cases

The `mutation` in `rejection_cases` explicitly specifies the tampering or mismatch to perform; verification should fail.

### Certificate and Account Binding

Cases in this section are under `management_chain`.

#### Synchronization Response Certificate Sets

`sync_certificate_cases` independently validates the response certificate set, using `sync_response.events` by default or an empty event array when `empty_page: true`. `certificate_actors` references certificates by their labels in `actors`, in order. `invalidate_device_signature_of` specifies XORing the first decoded byte of that certificate's device signature with `1`, then encoding it in the original format.

Verify both signatures and identity binding for every certificate, reject duplicate derived device IDs, and confirm that all event references resolve. Additional valid certificates, including certificates on empty pages, do not invalidate the set. Missing or duplicate certificates and additional invalid certificates MUST still be rejected. `expected_certificate_set_valid` asserts only the certificate-set validation result; it does not replace event or permission validation.

#### Event Signing Accounts

`signer_account_binding.event_index` points to the leave event in `chain` using a zero-based index. Each case replaces only that event's `signer_device_id` and uses the attached certificate. These certificates use the same signing public key, so the body signature and `expected_management_hash` remain valid. A certificate for the same account produces the same member result. A certificate whose account differs from the body's `account` MUST be rejected. Compare the result against `expected_accepted`.

#### Accounts in Application and Reset Requests

`member_request_account_binding` applies all `cases` separately to the join application and member key reset request in `requests`. `certificate_source = actor_A` uses A's certificate in `actors`; the other two values use the identically named certificates in `signer_account_binding.cases`. When `request_account` is provided, replace only the request's `account` and retain the original signature; otherwise keep the entire request unchanged.

`expected_signature_valid` independently asserts verification of the complete request signature. `expected_account_binding_valid` independently asserts equality of the request account, certificate account, and `session_account`. Both must be true to pass these two checks. A valid signature with failed account binding, or matching account binding with signature failure due to tampering, MUST both be rejected.

This set covers only signatures and account binding. Session validity, device identity, membership, invitations, and request lifecycle MUST still be verified separately.

### Concurrency, State Changes, and Visibility

Cases in this section are under `management_chain`.

#### Concurrency and Same-Value Updates

`concurrency` provides two signed updates against the same chain head. After accepting `first`, `conflicting` MUST return `state_conflict`; `retry`, re-signed after checking the new state, may proceed.

`same_value_updates` applies each case independently from the chain state specified by the zero-based `starting_event_index`. Even when a property value or role is unchanged, accept the event and advance to `expected_hash`; see `expected_projection` for the business projection. Unknown properties remain in the signed body and do not change the business projection. Resubmission of the original request and other updates referencing the old head MUST be rejected.

#### Ownership Round Trips and Replay

`ownership_round_trip` verifies the signed transfers from A to B and B to A and their projections from the state at `starting_event_index`. Then resubmit the original `replay_event`: although A has regained owner permissions, the request still references the pre-transfer `prev_hash`. It MUST return `state_conflict` as specified by `expected_replay_error`, leaving state and the chain head unchanged.

#### Bans and Membership Changes

`ban_transitions` independently applies the `steps` of each case from the chain state at the zero-based `starting_event_index`. Verify that banning removes current members at the same time, a mixed batch creates only one new key epoch, banning only nonmembers does not advance the key epoch, and unbanning does not restore membership.

Each step's `expected_projection` is the member and ban projection; `expected_removed_accounts` lists removed accounts. The key epoch is expressed by the outer event's `epoch`. Reapproval in the main chain uses a new member public key and establishes an ordinary member role.

#### Read Visibility

`visibility` consists of filtering cases, not transmitted objects. Intervals are inclusive `[start,end]`, with `null` indicating no end. All events whose `kind` is `management` are readable; messages, including encrypted nickname updates, must additionally fall within an authorized interval and still be retained. The start for a new device is calculated as the position after the timeline head at establishment. If there is no current read permission, rejection MUST occur before filtering.

Each implementation MUST separately verify transient invitations, sessions, staged boxes, message cryptography, and the atomic activation and failure recovery behavior required by the protocol.

### Encrypted Nicknames and Local State

Cases in this section are under `encrypted_nicknames`.

#### Message Business Types and Nickname Fields

`expected_business_valid` of `true` or `false` asserts a valid or invalid nickname structure, respectively. `null` denotes an unknown business type and MUST NOT cause a nickname change. `unknown_attributes` verifies that account, group, and role properties in the body cannot override authenticated context or member administration fields.

`encrypted_nicknames.field_cases` replaces `administrator_set.plaintext.nickname` for each case; `omit: true` removes that field. `expected_valid` asserts only client-side business validation; clearing with `null` is valid. Rejection of plaintext does not require the relay to return an error.

When encapsulating these variants, assign a different message ID to each, then re-encrypt and sign; do not reuse the same message's key/nonce. Coverage includes every code point in the common whitespace set, UTF-8 length boundaries, leading/trailing whitespace, and preservation of Unicode without alteration.

#### Message Authentication

`authentication_cases` uses the specified message and independently asserts envelope signature verification and AEAD results; actual receipt rejects if either authentication fails. `flip_ciphertext_byte` XORs the first decoded byte of `payload.ciphertext` with 1; `flip_nonce_byte` does the same to `payload.nonce`. `replace_group_id` changes the group in both envelope and AAD to `keying.input.group_id`; `replace_network_context` increases the trusted network's magic by 1.

Certificate replacement retains the original envelope and uses the replacement certificate's account and derived device ID when rebuilding AAD. An identical signing public key cannot bypass account or device AAD binding.

#### Local State and Processing Order

`local_cases` verifies logical local nickname state without prescribing client storage structures or persistence. Cases assume message authentication and administration-history verification are complete. Account labels reference `management_chain.actors`.

`sender_membership_starts` and `receiver_membership_start` are administration event sequence numbers for the current membership; the message must follow both.

Compare initial assertions and the processing results and local overrides of each `steps` item. `example_initial_display_names` and `example_display_names` are UI display examples, not protocol conformance assertions.

In a local override, `nickname: null` means no override while retaining the most recently applied `sequence`; it is not a member projection field. `message` references one of the message names above. `key_available: false` means this case chooses to queue the message for decryption without marking it applied; the key is available by default on a subsequent reference.

Reprocessing an already processed message has no side effects. A lower sequence cannot overwrite a higher one, and `created_at` is not used for ordering.

#### Local State Changes and Cleanup

The local step `profile_update` supplies a verified account display name; `member_leave` clears that member, and the `sequence` in `member_join` establishes the current membership. Administration event indexes provide only the corresponding historical evidence and cannot substitute for message access authorization.

`prune_messages` retains the local override; `clear_local_data` removes it. Steps containing only `management_event_index` do not change nicknames, including unbanning, role changes, key changes, and secret changes.

Cases cover delayed decryption, clearing, republication, multi-device concurrency, duplicate names, independence across groups, account profile changes not rewriting nicknames, missing history, pruning, and members rejoining.

#### Retries and Idempotency

`retry_cases` assumes the ordinary message idempotency retention period has not expired and current permissions remain valid. It verifies that an unchanged retry returns the original sequence, retrying an old message after a later rename does not roll back the nickname, and deliberately resending the same value produces a new event.

`change_created_at_and_resign` increases the original envelope's `created_at` by 1 and re-signs while retaining the message ID. Its duplicate submission returns `state_conflict`; the relay does not decrypt business content.

The `retry_envelope` in `new_nonce_same_message_id` is re-encrypted with a new random nonce and re-signed. Its plaintext is unchanged and both signature and AEAD are valid, but the complete envelope differs from the original request, so it still returns `state_conflict`.

#### Administration Changes and Nickname Retention

`management_preservation` starts from the supplied administration state, processes `nickname_message`, then processes `steps` in order, asserting the administration projection and `expected_local_nickname`. It covers nickname retention across role changes, member key resets, secret rotations, and ownership transfers.

#### History Omission

`history_omission` removes the specified message from the main chain. Verification still reaches the closure digest, but the local nickname is empty.
