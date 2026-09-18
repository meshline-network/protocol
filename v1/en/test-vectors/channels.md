# Channel Test Vector Execution Guide

[Normative test vectors](README.md) · [Common execution rules](README.md#common-execution-rules)

## Coverage

File: [`channels-v1.json`](../../test-vectors/channels-v1.json). It contains `channel_id`, `media`, `channel_signer`, `channel_write_cases`, and `channel_edit_sequences`.

## Fixed Inputs and References

`media` gives attachment plaintext and references. `channel_signer` is the test key shared by seven publication and edit signing cases.

The `post_case` in `channel_edit_sequences` points to the initial post in `channel_write_cases` in the same file; `post_sequence` gives its timeline position.

## Execution Steps and Assertions

### Channel ID

`channel_id` reconstructs Canonical JSON and SHA-256 from the supplied network context and ID inputs, then takes the first 16 digest bytes and adds the `chan_` prefix. Compare every intermediate value and the final ID.

### Publication and Edit Signatures

`channel_write_cases` provides complete signed business objects; channel posts also verify signature binding of the message ID. A text-only edit uses `attachments: null` to remove the attachment field; an attachment-only edit uses `body: null` to remove the body.

Changing the message ID, body type, text, attachment references, or the omission, `null`, or `[]` representation of a field without re-signing MUST cause signature verification to fail. Cases involving hash references MUST also verify matching against the current attachments after editing.

### Successive Edits and Current Projections

Apply the signed edit objects in `steps` in acceptance order. `applied` gives the updated body, effective attachments, and reference resolution results; `no_change` means the request succeeds without producing an edit event. Deleted fields are absent from the projection, while explicit empty arrays remain. `bad_request` means rejection with no state change.

These cases cover omission of body and attachments, deletion with `null`, complete replacement of objects and arrays, successive edits, no-change edits, prevention of old content reappearing, edits with no content, and rejection of duplicate hashes.
