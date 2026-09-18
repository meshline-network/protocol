# Common Foundations Test Vector Execution Guide

[Normative test vectors](README.md) · [Common execution rules](README.md#common-execution-rules)

## Coverage

File: [`common-v1.json`](../../test-vectors/common-v1.json). Sections: `canonical_json`, `base64url`, `unsigned_varint`, `object_types`, `network_binding`, `x25519`, and `encrypted_payload`.

## Fixed Inputs and References

Each section uses its own fixed inputs; network-bound operations use the root `network_context`. The corresponding sections provide the supported type set, original container values, and X25519 test keys.

`object_types.message_authentication.envelope_ref` and `network_binding.signature_context.envelope_ref` both reference `/object_types/signed_envelope/envelope`. Once expanded, they are used for AAD authentication and candidate-context signature verification, respectively, with independent assertions.

## Execution Steps and Assertions

### JSON and Encoding

#### Canonical JSON

`canonical_json.vectors` covers Canonical JSON, Unicode, control characters, safe integers, and network-bound inputs. `rejection_vectors` covers duplicate properties, lone surrogates, negative zero, non-integer representations, and out-of-range integers. Compare or reject under the common execution rules.

#### base64url

`base64url.cases` checks canonical encoding of the `input` text. When `prefix` is supplied, require an exact match and perform the base64url check only on the remainder. When `decoded_length` is supplied, also require that decoded byte length. The result MUST equal `expected_accepted`, and accepted bytes MUST equal `decoded_hex`.

These cases check only encoding and the declared prefix and length; they do not waive identity derivation, signatures, random generation, or other business checks for real objects. Acceptance of an empty string establishes only encoding validity and does not relax a field's nonempty requirement. Rejection cases MUST NOT be accepted after rewriting the input.

#### unsigned-varint

`unsigned_varint.prefix_cases` uses `input_hex` for the complete bytes of the prefix to check. The stream ends after these bytes, so incomplete prefixes MUST be rejected. The result MUST equal `expected_accepted`; for accepted cases, the exact integer MUST equal the decimal string `decoded_value_decimal`, and encoding that integer MUST reproduce the same bytes. This string is only a test representation for exact binary lengths beyond the JSON safe-integer range.

`length_limit_cases` references an accepted `prefix_case`, then compares it with the supplied test `max_payload_bytes`. The result MUST equal `expected_within_limit`.

These vectors check only prefix encoding and declared length; they contain no payload. The encoding validity of prefix `00` does not establish that a zero-length message satisfies its transport or business rules, and a well-formed oversized number is not an allowed incoming message length.

### Types and Network Binding

#### Object Types

`object_types.supported_content_types` is the supported type set for this dispatch test, not the set of all protocol types. `content_type_cases` first checks the required string `$type`, then performs full, case-sensitive matching. An object name in `expected` only selects that object's subsequent validation rules; it does not establish that all validation has passed. `unsupported_type` MUST NOT dispatch to a known type or trigger an unsupported state change; `invalid_type` MUST be rejected.

`signed_envelope.cases` replaces or removes only the envelope's root `$type` as specified, retains the original signature, reconstructs the network-bound signing input, and checks the signature verification result.

`message_authentication.cases` reconstructs the message AAD from the original envelope, then replaces or removes only the AAD's root `$type` and directly performs AES-GCM authentication. No plaintext may be delivered on failure.

Suffixes such as `.v1`, `.v2`, and others in the vectors are only unknown-type tests; they do not register new types.

The ordinary `type` in dispatch cases is not an alias of `$type`. `expected_preserved_fields` specifies unknown properties that MUST remain unchanged after dispatch; they do not participate in type selection.

#### Network Context

`network_binding.format_cases` checks whether the input is a valid complete context string, without normalizing it first. Acceptance MUST equal `expected_accepted`.

`binding_cases` uses the file's trusted `network_context`: `device_signature` and `account_signature` each remove only the corresponding root signature field, retain nested signatures, and inject `$context`; `local_input` checks that the existing `$context` exactly equals the trusted value and occurs only once.

`nested_protocol_object_paths` identifies the nested protocol object paths to check independently in this case, with property names or array indexes as path elements. Real implementations identify these boundaries from the object structure. If `$context` appears at the transmitted object's root or in any of these nested objects, it MUST be rejected before constructing the input, even when its value is equal or `null`. Accepted cases compare Canonical JSON, UTF-8, and SHA-256 byte for byte; rejected cases MUST NOT produce these results.

`signature_context.cases` retains the original envelope and signature, changes only the supplied trusted test context, and independently reconstructs the signing input and verifies the signature. These assertions check only input construction and cryptographic binding; they do not establish complete business validity. `forbidden_wire_context` and `context_mismatch` are test labels, not protocol error codes.

### Cryptographic Primitives and Ciphertext Containers

#### X25519

Each `x25519.cases` item uses unpadded base64url `private_key` and `peer_public_key` values as X25519 inputs. `expected_raw_shared_secret` is the expected output bytes of the underlying X25519 mathematical operation. When `expected_accepted` is `true`, the same nonzero shared secret MUST result. When it is `false`, the key box operation MUST abort under [X25519 shared-secret validation](../general.md#x25519-shared-secret-validation), and the all-zero result MUST NOT be passed to HKDF. Direct rejection of this key agreement by the cryptographic library is also conforming; returning all-zero bytes externally is not required.

This check applies both to the wrapping side using the target public key and to the unwrapping side using `enc`, covering message key boxes and both types of group secret boxes. A subsequent AES-GCM authentication failure MUST NOT substitute for the all-zero check.

Positive inputs come from RFC 7748 Section 6.1. Negative inputs include `u = 0`, `1`, `p - 1`, `p`, and `p + 1` (`p = 2^255 - 19`), plus variants with the highest encoding bit set for `u = 0` and `1`. This section tests only the cryptographic primitive and uses no network context.

#### Ciphertext Containers

`encrypted_payload.cases` asserts only structural validity of the shared ciphertext container. Copy `encrypted_payload.input`, then replace `value` at `path` or apply `remove`; an empty path operates on the entire container. Unknown algorithms, missing fields, invalid types, incorrect nonce length or encoding, and ciphertext shorter than the tag length MUST all be rejected. A top-level envelope `ciphertext` cannot fill in a missing `payload`. A tag-only container passes this structural check but does not establish AEAD or business JSON validity.
