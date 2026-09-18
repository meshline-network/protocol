# Meshline Protocol 1.0 Normative Test Vectors

[Meshline Protocol 1.0](../README.md)

The following eight JSON files provide implementation-independent normative test vectors. Each file contains the fixed inputs needed for its topic and can be read independently. Read the common execution rules on this page first, then follow “Coverage → Fixed Inputs and References → Execution Steps and Assertions” in each topic's execution guide.

| File | Topic | Verification coverage |
|---|---|---|
| [`common-v1.json`](../../test-vectors/common-v1.json) | [Common foundations](common.md) | Canonical JSON, base64url, unsigned-varint, type dispatch, network binding, X25519, ciphertext container structure |
| [`identity-auth-v1.json`](../../test-vectors/identity-auth-v1.json) | [Identity and authentication](identity-auth.md) | Device identity derivation, dual certificate signatures, origin, device and account authentication signatures |
| [`contacts-v1.json`](../../test-vectors/contacts-v1.json) | [Contacts](contacts.md) | Grant signatures and format, grant selection and merging, invitation signatures and types |
| [`message-encryption-v1.json`](../../test-vectors/message-encryption-v1.json) | [Message encryption](message-encryption.md) | Envelope signatures, AAD authentication, payload encryption/decryption, sender and recipient key boxes |
| [`message-content-v1.json`](../../test-vectors/message-content-v1.json) | [Body and attachments](message-content.md) | Body format and rendering safety, attachment encryption, hash reference resolution, message authentication binding |
| [`channels-v1.json`](../../test-vectors/channels-v1.json) | [Channels](channels.md) | Channel IDs, publication and edit signatures, successive edit projections, attachment reference resolution |
| [`groups-v1.json`](../../test-vectors/groups-v1.json) | [Groups](groups.md) | Group IDs and cryptography, administration chains and state transitions, certificate and account binding, visibility, encrypted nicknames and local state |
| [`dht-keyspace-v1.json`](../../test-vectors/dht-keyspace-v1.json) | [DHT](dht-keyspace.md) | Resource key derivation, FIND_NODE requests and framing, keyspace mapping and XOR distance |

## Common Execution Rules

The inputs, raw UTF-8 bytes, and expected results are normative data. Private keys in the vectors are for interoperability testing only; no deployment may use these keys.

### File Structure and Trusted Context

- Every file root uses `$type: "meshline.protocol.test-vectors"` and the string `protocol_version: "1.0"`; other named sections are organized by topic. File metadata is not part of a wire protocol object.
- `protocol_version` in a vector file and `v1` in its filename identify the applicable specification version, not a protocol object format selector. Objects and cryptographic inputs use only their own `$type`; interpret it under [Object types](../general.md#object-types) without inserting a default `version`.
- `network_context` and `candidate_network_context` are trusted context strings for testing, with the same format as `$context`; they are not fields of network objects. Signing, hashing, and cryptographic inputs defined as network-bound use `$context`, which is not carried in transmitted objects. `$context` in `aad_overrides` is used only to tamper with local AAD for authentication-failure tests.
- The root `network_context` is the trusted value for network-bound operations in that file. Pure encoding, X25519, container structure, and keyspace operations on raw Peer IDs do not use it. If a case explicitly supplies a candidate context, override only the test input it specifies.

[Account IDs](../client-relay/core-objects/accounts-and-devices.md#account-id) in the vectors use the CAIP-10 format `neo:<reference>:<address>`. Cryptographic inputs involving an account ID use this entire string; the corresponding signatures, identifiers, hashes, key derivations, and encryption results MUST match it.

### Exact Data and Result Comparison

- `input_json` is the exact JSON text to parse, and `input_utf8_hex` is its UTF-8 bytes; after decoding, they MUST be identical character for character.
- `canonical_json` is the canonical single-line JSON; `utf8_hex` and `utf8_base64` are its exact UTF-8 bytes. Implementations MUST NOT substitute reformatting these display values for comparison of the original bytes.
- `sha256_hex` and `sha256_base64url` are two representations of the same 32-byte SHA-256 result. base64url MUST follow the [canonical encoding](../general.md#base64url-encoding) in the general rules. The display field `utf8_base64` is ordinary base64, not a protocol base64url field.
- Inputs in `rejection_vectors` MUST be rejected before generating signatures, hashes, or business objects. Implementations MUST NOT rewrite them into another JSON value and continue processing.
- Signing inputs, AAD, KDF info, ciphertext, authentication tags, and signatures in each topic are exact protocol bytes and MUST be independently reconstructed from the fixed inputs and compared. Comparison of generated account ECDSA signatures follows the nonce rules below.

For JSON vectors, implementations should first verify that `input_json` matches `input_utf8_hex`, perform the specified operation, and compare the Canonical JSON, raw bytes, digest, and final ID or key together. Then confirm individually that the corresponding rejection cases produce no Canonical JSON. Any difference in a result requiring exact comparison indicates incompatibility.

### Signature and Cryptographic Verification

Account ECDSA signatures in the vectors are generated deterministically using RFC 6979 and SHA-256:

- Implementations using this generation method MUST compare the generated signatures byte for byte.
- Implementations using random nonces allowed by the protocol MUST independently reconstruct and compare the signing input, verify the supplied vector signature, and verify their own generated signature. A randomly generated signature need not equal the vector's signature bytes.
- When a vector signature is an input to a nested object, subsequent signature, or hash, the original supplied signature bytes MUST be used. Do not substitute another generated signature and expect identical derived results.
- Ed25519 signatures and other deterministic results still require exact comparison.

Cryptographic vectors MUST also complete all applicable signature verification, key box unwrapping, payload decryption, and external content decryption.

### Same-File Input References

- In test metadata, `<field>_ref` replaces `<field>` at the same location. Its value is a same-file JSON Pointer starting with `/`; property-name characters `~` and `/` are represented by `~0` and `~1`, and array items use zero-based indexes. When reading, copy the actual referenced value and restore the original field before executing the case. For example, `signing_device_ref: "/grants/signing_devices/0"` restores the complete `signing_device` input.
- References point directly to actual data; they do not cross files or form chains. A field and its corresponding `_ref` do not coexist. Each tampering case independently copies the expanded input and cannot modify the shared original value.
- Resolve only the surrounding test references explicitly listed in each topic's execution guide. Keep the contents of complete transmitted objects, signing inputs, and expected responses unchanged. Unknown properties in real protocol objects are not test instructions even if their names end in `_ref`.
- Existing case associations such as `label`, `name`, `id`, `post_case`, and event indexes retain their original rules. Field paths in each topic's guide are relative to the indicated section; root trusted context and cross-section paths are identified separately.

### Test Metadata and Assertion Boundaries

Surrounding fields such as `scope`, case names, input changes, expected results, and projections describe tests; do not add them to wire requests, responses, signing inputs, or business objects. Interpret result names and labels only as directed by the execution guide; they do not independently register protocol fields, object types, or error codes.

Each case asserts only the checks it lists. Format validity, signature validity, AEAD authentication, and business authorization MUST be verified separately; passing one cannot substitute for other applicable checks. Topic guides retain the specific boundaries of each set. Verify uncovered behavior under the following conformance requirements.

## Conformance Testing Boundaries

A conforming implementation MUST pass the applicable vectors and verify the behavior of its implemented modules. Comparing deterministic results cannot replace behavioral tests.

Behavioral tests MUST cover normal paths, field omission and invalid input, encoding and signature tampering, numeric and time boundaries, and text and complete-object size limits. Where state or asynchronous processing is involved, they MUST also cover concurrency, duplicate submissions, lost responses or notifications, configuration changes, and restart recovery. When a method supports multiple transports, its parameters, authorization, business results, and error semantics MUST be consistent.

The corresponding specification text defines field constraints, state transitions, and expected results. The following entry points summarize coverage by topic; derive specific cases from the specification rules and applicable vectors:

- [Client–relay protocol](../client-relay/README.md#conformance-requirements) covers relay discovery, sessions, account state, contacts, and reliable messaging.
- [Channel hosting protocol](../client-relay/channels/README.md#conformance-requirements) covers channel IDs, signatures, revisions, permissions, post deletion, bounded retention, sequence gaps, and timeline reconstruction.
- [Group hosting protocol](../client-relay/groups/README.md#conformance-requirements) covers fixed hosting, separate secrets, member/device access state machines, private state, and closure semantics.
- [Relay DHT](../relay-dht/README.md#conformance-requirements) covers multi-node storage and retrieval, prevention of revision rollback after route expiry or restart, retention on same-revision conflicts, network partitions, and invalid Peers.
- [Relay RPC](../relay-rpc/README.md#conformance-requirements) covers connection identity, cross-relay queries, reliable delivery, error recovery, and restart.

Conformance verification MUST perform interoperability testing using at least one reference implementation with an independent network transport testing tool, or two mutually independent implementations.
