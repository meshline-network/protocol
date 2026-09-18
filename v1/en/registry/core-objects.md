# Relay Registry core objects

[Relay Registry](README.md)

## Relay ID

`relay_id` identifies a relay's Neo account and is the canonical textual representation of that account's script hash: 40 lowercase hexadecimal characters prefixed with lowercase `0x`. The Registry ABI represents this value as `UInt160`. A textual `relay_id` in the network protocol MUST match `^0x[0-9a-f]{40}$` and is compared as a complete string. Noncanonical forms MUST be rejected and MUST NOT be accepted after case conversion.

## `RelayEntry`

`RelayEntry` is the ABI structure returned by `getRelay` and `listRelays`, representing the current membership state of a public relay. Fields are returned in the order shown below:

| Field | Logical type | Required | Semantics and constraints |
|---|---|---|---|
| `relay_id` | UInt160 | Yes | The relay's on-chain identity; when converted to protocol text, use the format defined by [Relay ID](#relay-id) |
| `endpoint` | string | Yes | Canonical HTTPS base address; MUST begin with `https://`; its UTF-8 encoding MUST NOT exceed 512 bytes and MUST NOT contain whitespace, a query, fragment, userinfo, or backslash |
| `status` | string | Yes | Current Registry membership status: `active` means the relay may be used as a candidate public relay; `disabled` means the operator has disabled membership; `suspended` means Registry governance has suspended membership. Neither of the latter two states permits use as a candidate relay |
| `updated_at` | unsigned integer | Yes | UTC Unix milliseconds of the most recent creation, endpoint update, or status update |
