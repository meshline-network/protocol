# Body and Attachment Test Vector Execution Guide

[Normative test vectors](README.md) · [Common execution rules](README.md#common-execution-rules)

## Coverage

File: [`message-content-v1.json`](../../test-vectors/message-content-v1.json). Sections: `body`, `attachment_encryption`, and `hash_references`.

## Fixed Inputs and References

`body.media` supplies attachment plaintext and references. Encryption cases in `attachment_encryption` and `hash_references` each retain their own plaintext, keys, AAD, and expected results. `hash_references.resolution_cases` resolves references only within the attachment array supplied by that case.

## Execution Steps and Assertions

### Body Format and Rendering

All `body.body_cases` items are valid body cases. When `interpretation` is provided, verify that interpretation too. `invalid_body_cases` MUST be rejected; `rendering_safety_cases` specifies handling requirements for raw HTML and unsafe links.

Valid `content_type` values in body vectors may omit `charset` or use `utf-8`; parameter names and values are case-insensitive. `body_cases` covers these valid forms, while charset parameters in `invalid_body_cases` verify rejection of other charsets and empty values.

### Attachment Encryption

`attachment_encryption` provides an encrypted `ContentReference`, original plaintext, exact AAD, and ciphertext with its tag. Independently compare encryption inputs and verify external content decryption.

### Hash References and Resolution

`hash_references.uri_generation` computes SHA-256 text and a `ni:` URI from fixed plaintext. `hash_cases` checks attachment hash fields; `resolution_cases` matches only against the attachments provided by each case. The `index` in `resolved` is the expected position in that case's attachment array; `unresolved` means no target matched, `invalid_reference` means a malformed reference, and `invalid_attachments` means invalid attachment fields or duplicate hashes.

`expected_targets` in `markdown_cases` contains only actually parsed `ni:` images and links. It excludes code, escaped syntax, plain text, and literal text in unknown formats.

### Message Authentication of Attachment References

`encrypted_attachment` and `re_encrypted_attachment` in `hash_references` provide two sets of attachment encryption inputs and outputs for checking the plaintext digest, AAD, ciphertext, and decryption result.

`private_message` and `group_message` give exact body bytes, AAD, ciphertext, and signatures. Account messages use a fixed content key; group messages derive a 32-byte `message_key` from the supplied group application secret and use the fixed test input `message_nonce`. Neither involves construction of key boxes for sender or recipient devices.

Changing a body hash URI or attachment reference without regenerating the message authentication data MUST fail. Decryption of the attachment itself and verification of its plaintext digest remain independent checks.
