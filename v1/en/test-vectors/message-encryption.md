# Message Encryption Test Vector Execution Guide

[Normative test vectors](README.md) · [Common execution rules](README.md#common-execution-rules)

## Coverage

File: [`message-encryption-v1.json`](../../test-vectors/message-encryption-v1.json). Sections: `envelope_signature`, `payload`, and `timeline`.

## Fixed Inputs and References

`envelope_signature` retains separately supplied signing input and signature results. Restore its two external inputs according to the following table:

| Reference field (relative to `envelope_signature`) | Target in the same file |
|---|---|
| `unsigned_object_ref` | `/payload/encryption/envelope` |
| `recipient_boxes_ref` | `/payload/encryption/recipient_boxes` |

`payload.aad` provides the original AAD. `payload.encryption` provides fixed inputs and results for X25519/HKDF/AES-GCM. `timeline` is an independent, complete request case containing key boxes for both sender and recipient.

## Execution Steps and Assertions

### Envelope Signing and Recipient Decryption

Reconstruct the signing input from the restored unsigned envelope, compare it with the supplied input and signature, and verify the signature. Unwrap the recipient key box and decrypt the body, comparing the AAD, key derivation, and encryption/decryption results individually.

### AAD Authentication Rejection

`payload.aad_rejection_cases` uses the fixed content key, nonce, and ciphertext from `payload.encryption`. First reconstruct the message AAD object from that envelope and `network_context`, then replace the input fields specified by each case's `aad_overrides`, regenerate the Canonical JSON bytes, and directly perform AES-GCM authenticated decryption. `expected_authenticated: false` requires authentication failure without delivering plaintext.

These cases cover context mismatches caused by separate changes to the message ID, creation time, sender account, sender device, target account, network number, and Registry address. Envelope signature failure alone MUST NOT substitute for this authenticated decryption check.

### Sender and Recipient Key Boxes

The KDF/AAD inputs, shared secrets, wrapping keys, and decryption results of the key boxes in `timeline` are exact protocol bytes. The implementation MUST also confirm that the original envelope's device signature is valid and that the sender key box can decrypt the same payload.
