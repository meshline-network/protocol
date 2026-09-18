# Identity and Authentication Test Vector Execution Guide

[Normative test vectors](README.md) · [Common execution rules](README.md#common-execution-rules)

## Coverage

File: [`identity-auth-v1.json`](../../test-vectors/identity-auth-v1.json). Sections: `device_identity`, `device_certificate`, `relay_origin`, and `session_auth`.

## Fixed Inputs and References

`device_identity` and `device_certificate` provide device derivation inputs and account/device test keys, respectively. `session_auth.signers` reuses these inputs; restore its fields according to the table below:

| Reference field (relative to `session_auth.signers`) | Target in the same file |
|---|---|
| `account_ref` | `/device_certificate/account` |
| `account_private_key_ref` | `/device_certificate/private_key` |
| `account_public_key_ref` | `/device_certificate/public_key` |
| `device_private_key_ref` | `/device_certificate/device_private_key` |
| `device_public_key_ref` | `/device_certificate/device_public_key` |
| `device_id_ref` | `/device_identity/derived_device_id` |

`source` only describes the origin of the test keys. `target` represents the target identity and endpoint obtained by the client from a verified descriptor, and `challenge` supplies a fixed test challenge. The device certificate is in `session_auth.device_auth.request.signer_certificate`; verify its dual signatures and device ID derivation.

## Execution Steps and Assertions

### Device Identity and Certificates

`device_identity` supplies the identity derivation inputs, Canonical JSON, UTF-8 bytes, digest, and device ID. `device_certificate` supplies account and device test keys, an unsigned certificate, and inputs and results for both signatures. Verify the device signature first, then retain that signature when reconstructing the account signing input; verify both signatures and device ID derivation.

### Origin and Sessions

#### Origin Normalization

`relay_origin.normalization_cases` converts `endpoint` to `expected_origin`, whose UTF-8 bytes MUST equal `expected_origin_utf8_hex`. `comparison_cases` normalizes both endpoints before comparing them; the result MUST equal `expected_same_origin`. Device and account authentication both use this result as the `origin` in the signing input.

Endpoints in the origin vectors MUST also pass [endpoint format validation](../client-relay/core-objects/relay-descriptor.md#relay-endpoint-addresses). Normalizing the authentication origin does not rewrite addresses in the signed descriptor and cannot make a malformed endpoint valid. Verify candidate rejection and request path construction under [Relay discovery](../client-relay/concepts/discovery-and-sessions.md#relay-discovery) and [Method and request mapping](../client-relay/methods/conventions.md#method-and-request-mapping).

#### Authentication Inputs and Signatures

For `device_auth` and `account_auth`, independently reconstruct the local `auth_payload` from `request`, the trusted target, and the network context under the [Session authentication](../client-relay/methods/authentication-and-sessions.md#session-authentication) rules. Add `$context`, then compare the Canonical JSON, UTF-8 bytes, SHA-256, and signature. `request` contains the wire request parameters; do not add other derived inputs or assertion fields to it.

#### Authentication Verification and Rejection

Run `verification_cases` separately for both authentication types. Use the case's `trusted_relay_id` as the receiving relay's own identity, compute the origin from `endpoint`, and use its `network_context`. If `nonce_override` is present, replace the request nonce. If `request_extra_fields` is present, merge it only into the request; it cannot change the trusted relay identity. Keep other request fields unchanged, use the original signature named by `signature_field`, reconstruct the input under the new rules, and check `expected_signature_valid`.

`legacy_signing_input_utf8_hex` and `legacy_signature` supply only the old input that omits relay_id and its valid signature, for rejection tests. This signature is valid for the old input but MUST fail verification against the new input containing the trusted relay_id. A verifier MUST NOT try the old input as a fallback.

HTTPS/WSS variants or paths with the same origin on the same relay assert only equivalent signing inputs; they do not permit reuse of a connection, nonce, or session token. These vectors do not cover Registry/descriptor validation, challenge state, current device authorization, or actual session establishment.
