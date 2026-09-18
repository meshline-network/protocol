# Contact Test Vector Execution Guide

[Normative test vectors](README.md) · [Common execution rules](README.md#common-execution-rules)

## Coverage

File: [`contacts-v1.json`](../../test-vectors/contacts-v1.json). Sections: `signing`, `grants`, and `invites`.

## Fixed Inputs and References

`signing.vector` provides a standalone signing case. `grants.signing_devices` provides the test keys, device IDs, and dual-signed certificates used by the grant cases.

`grants.verification_time` is the current time used by the test. `grants.current_valid_devices` is the set of labels for currently authorized devices; it is a test precondition, not account-signed device state.

`invites.invites` provides complete objects, exact signing inputs, and digests by `label`. Verify them with the test device key restored through `invites.signing_device_ref` from `/grants/signing_devices/0`.

## Execution Steps and Assertions

### Grant Signing and Selection

#### Grant Signing

`signing.vector` signs the entire `grant` body after excluding the root `signatures`, using `network_context` to construct the network-bound input. Compare against `signing_input_canonical_json`, `signing_input_utf8_hex`, and `signature`. The `future_data` in the body MUST participate in signing. The `device_id` in this case is a fixed test map key, and the empty `signatures` is used only to construct the signing input; it is not a valid grant for transmission.


Each `signing.verification_cases` case starts independently from `signing.vector`. First remove the root body fields listed in `grant_remove_fields`, then merge `grant_overrides`. When supplied, `device_id`, `signature`, `network_context`, or `public_key` replaces the corresponding test input without re-signing. Treat the signature being verified as the map value for the corresponding device ID; reconstruct the signing input by excluding the entire root `signatures`, then compare against `expected_signature_valid`. These cases assert only cryptographic signature verification; they do not waive object type, device identity, current authorization, or field rules. This signature does not protect the map key, so its validity does not establish that the grant is valid.

#### Grant Selection and Merging

`grants.grants` provides complete grants and the `signing_input_utf8_hex` shared by their devices. Verify each entry in `signatures` using the test keys and dual-signed certificates in `signing_devices`.

Each `selection_cases` case independently starts with the saved grant named by `current` and uses the new grant named by `candidate`. Resolve both references by `grants.label`. If `candidate_overrides` is supplied, replace only the specified root fields without re-signing. If `candidate_network_context` or `current_valid_devices` is supplied, override only that test input for the case.

The `invalid_null_*` grants have valid signatures, but an unknown root field, nested property, or array element contains a disallowed `null`. The corresponding selection cases MUST reject them under the field rules and retain the existing grant.

In grant selection cases, `replace` means adopt the complete new grant; `keep` means discard a new grant with a different body and a shorter or equal validity period; `merge` means merge valid signatures by device ID for an identical body; `invalid` means the new grant failed validation; and `out_of_scope` means it does not belong to the same trusted network context and directed account pair.

When merging, if both signatures for the same device are valid, retain the existing signature and continue adding valid signatures for devices missing locally. An invalid signature cannot overwrite an existing valid signature. `keep`, `invalid`, and `out_of_scope` all retain the existing grant.

All cases MUST compare the referenced complete body and signature map against `expected_selected`. Key order is not a merge-result requirement. Cross-scope cases assert only that the current grant cannot be replaced.

A1 and A2 use the same signing key but different encryption public keys and device IDs. These cases verify that a signature can be used under the ID of a currently valid device with the same signing key, and that a different signing key or account cannot reuse it. `inactive_signer_cannot_renew` still requires rejection of the non-current device ID referenced by the original map key; it does not automatically substitute another device. Contact record revisions, tombstones, delivery authorization, and relationship establishment MUST also be verified separately under [Contacts and authorization](../client-relay/concepts/contacts.md).

#### Grant Format

The `input_json` in `grants.format_cases` is the raw JSON text of a complete grant. First check duplicate keys under the general JSON rules, then check required fields and that the signature map is nonempty and has valid device ID and signature encodings. Compare against the `accept` or `reject` in `expected`. `accept` indicates format validity only; it does not replace device authorization, validity-period checks, or signature verification.

Duplicate-device-key cases MUST parse the raw text directly, without first converting it to a map that overwrites duplicate keys. Duplicate keys MUST be rejected whether their values are identical, only the first value is valid, or only the last value is valid. Other cases cover arrays, missing or empty maps, invalid keys, entry objects, non-string values, and non-canonical signature encodings.

### Invitations

`unsupported_friend_invite` is used only to verify rejection of the old type; it is not an allowed invitation type.

Each `verification_cases` case independently copies the object named by `invite`, replaces only the root fields specified by `invite_overrides`, and retains the original signature. When `network_context` is supplied, it overrides the trusted network context for that case.

Remove the root `device_signature` and add the trusted `$context` to reconstruct the Canonical JSON bytes, then independently verify `expected_signature_valid`. Verify `expected_type_supported` by checking whether the full `$type` equals `meshline.contact.invite`. An implementation MUST NOT rewrite the old type to the new type before verifying the signature, or accept the old type merely because its signature is valid.

Passing both checks above establishes only signature and type validity. Invitation account binding, validity period, current validity of the signing device, and delivery authorization MUST still be verified under [`ContactInvite`](../client-relay/concepts/contacts.md#contactinvite).
