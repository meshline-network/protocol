# Account Profiles and Device Certificates

[Client–relay protocol](../README.md) · [Core object index](README.md)

## Account ID

Account IDs use [CAIP-10](https://chainagnostic.org/CAIPs/caip-10) in the form `<namespace>:<reference>:<account_address>`. The first two components form a [CAIP-2](https://chainagnostic.org/CAIPs/caip-2) chain identifier. For namespace and chain-identifier rules, see [Chain Agnostic Namespaces](https://github.com/ChainAgnostic/namespaces).

Account IDs are compared as complete, case-sensitive strings. Unicode normalization MUST NOT be performed.

### Neo N3

Neo N3 account IDs have the form `neo:<reference>:<address>`. Chain identifiers follow the [Neo CAIP-2 profile](https://namespaces.chainagnostic.org/neo/caip2), with these rules:

- `reference` is the canonical unsigned decimal text of the Neo N3 network magic. It MUST match `^(0|[1-9][0-9]{0,9})$`, and its parsed value MUST be within the range defined in [Network context](../../general.md#network-context). Leading zeros, a plus sign, whitespace, and network names are forbidden.
- `address` MUST be derived from the account public key under the [Neo N3 single-signature address rules](https://docs.neo.org/docs/n3/foundation/Wallets.html#ordinary-address), using Base58Check with address version `0x35`.

The network magic in an account ID MUST equal the network magic in the trusted [network context](../../general.md#network-context).

Account signature algorithms, signature format, and public-key representation follow the [Signature](https://docs.neo.org/docs/n3/foundation/Wallets.html#signature) and [Public Key](https://docs.neo.org/docs/n3/foundation/Wallets.html#public-key) sections of the Neo N3 wallet specification.

## Device Certificates and State

### `DeviceCertificate`

`DeviceCertificate` is a time-limited certificate co-signed by the device and account. The device signature proves possession of the listed device signing private key; the account signature approves that device identity and this validity period. A certificate represents a currently valid device only when included in the current `AccountDeviceState` and when `not_before <= now < expires_at`.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.device.certificate` |
| `account` | string | Yes | The certificate's [account ID](#account-id); MUST match the account derived from `account_public_key` under that chain's rules |
| `account_public_key` | string | Yes | Account public key, unpadded base64url; follows the representation in [Account signatures](../../general.md#account-signatures) |
| `signing_public_key` | string | Yes | 32-byte Ed25519 device signing public key, unpadded base64url |
| `encryption_public_key` | string | Yes | 32-byte X25519 device encryption public key, unpadded base64url |
| `not_before` | integer | Yes | UTC Unix seconds when the certificate becomes effective |
| `expires_at` | integer | Yes | UTC Unix seconds when it expires; MUST be later than `not_before`, with an interval no longer than 720 days |
| `device_signature` | string | Yes | This device's 64-byte Ed25519 signature over the certificate body, unpadded base64url |
| `account_signature` | string | Yes | The account's signature over the certificate already containing the device signature, under [Account signature rules](../../general.md#account-signatures), unpadded base64url |

Certificates MUST be signed in this order:

1. The device signing input excludes both root `device_signature` and `account_signature`. The device generates `device_signature` with the private key corresponding to `signing_public_key`.
2. The account signing input excludes only root `account_signature`, thus including the `device_signature` from step 1. The account generates `account_signature`.

Verifiers MUST verify both signatures and the account-public-key/account-ID binding. The Canonical JSON UTF-8 encoding of `DeviceCertificate` MUST NOT exceed 4 KiB (4,096 bytes).

Renewal signs a new certificate under these rules. Clients should persist it before including it in the next account device state.

Later certificate expiry, replacement, or device removal does not retroactively negate signature and authorization checks completed when an object was accepted.

### Device ID

Implementations construct the following device identity input from stable identity fields in [`DeviceCertificate`](#devicecertificate). It is a canonical derivation input, not a separate transmitted object:

```json
{
  "$type": "meshline.device.identity",
  "account": "neo:860833102:...",
  "signing_public_key": "base64url...",
  "encryption_public_key": "base64url..."
}
```

The device ID is derived by the following formula, where `device_identity_input` denotes the device identity input above:

```text
device_id = "dev_" + base64url(first_16_bytes(SHA-256(network_bound_json_bytes(device_identity_input))))
```

Device IDs MUST match `^dev_[A-Za-z0-9_-]{22}$`. Verifiers MUST recompute the ID from the certificate and compare it character for character.

Device IDs index devices within account scope, bind sessions, and query current authorization state. The complete `DeviceCertificate` provides device public keys, validity period, and dual signatures.

Validity periods and signatures are excluded from identity input, so renewing with the same account and device keys preserves the device ID. Changing either device key creates a new device ID.

### `AccountDeviceState`

`AccountDeviceState` is a complete, atomic snapshot of an account's device permissions.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.account.device.state` |
| `account` | string | Yes | Account ID to which this state belongs |
| `account_public_key` | string | Yes | Account public key that MUST derive `account` |
| `revision` | integer | Yes | Nonnegative monotonic revision of account device state |
| `certificates` | array&lt;DeviceCertificate&gt; | Yes | Complete set of currently registered device certificates; may be empty, with at most 8 entries |
| `account_signature` | string | Yes | Account signature over the complete state under [Account signature rules](../../general.md#account-signatures), unpadded base64url |

Account signing excludes root `account_signature`. The complete Canonical JSON UTF-8 encoding MUST NOT exceed 128 KiB (131,072 bytes). All devices MUST belong to the same account, pass dual certificate-signature verification, and have distinct derived device IDs.

The recommended initial state revision is the calibrated current UTC Unix time in milliseconds.

Replacing current device state MUST use a strictly greater `revision`. It MUST be a [nonnegative safe integer](../../general.md#safe-integers-and-counter-advancement) and remain monotonically increasing within the account.

It is recommended to use current UTC Unix milliseconds as a lower bound and ensure the new value exceeds the known revision:

```text
revision = max(current_revision + 1, current_unix_time_milliseconds)
```

The effects of device-state changes and certificate renewal on sessions follow the [device-session rules](../methods/authentication-and-sessions.md#session-validity-and-connection-binding).

## `AccountProfile`

`AccountProfile` is a publicly available account profile snapshot signed by an authorized device. Any caller knowing the complete account ID may read it under the access rules of [`profile.resolve`](../methods/profiles.md#profileresolve), without target-account authorization or a contact relationship.

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.profile` |
| `account` | string | Yes | The profile owner's [account ID](#account-id) |
| `nickname` | string | No | User-facing display name; if nonempty, MUST NOT consist solely of [whitespace characters](../../general.md#text-whitespace-characters); at most 256 UTF-8 bytes; account ID is the basis for identity comparison |
| `avatar` | [ContentReference](messages-and-content.md#contentreference) | No | Avatar content reference; `content_type` MUST be an image media type such as `image/png`, and the plaintext MUST be image content |
| `bio` | string | No | Biography; if nonempty, MUST NOT consist solely of [whitespace characters](../../general.md#text-whitespace-characters); at most 2 KiB (2,048 UTF-8 bytes) |
| `public_discovery` | boolean | Yes | `true` opens the current device set and first contact without an invitation; `false` disables both public capabilities |
| `updated_at` | integer | Yes | UTC Unix seconds when this profile was signed, used to compare profile recency |
| `device_signature` | string | Yes | Publisher's 64-byte Ed25519 signature using the calling device over the current `AccountProfile` excluding this field, unpadded base64url |

The complete `AccountProfile` Canonical JSON UTF-8 encoding MUST NOT exceed 8 KiB (8,192 bytes), including `device_signature`, the `avatar` reference object, and all unknown properties. Individual field constraints also apply. This limit applies to publication and profiles carried in any read, message, or declaration.

Signing input follows [Network-bound JSON inputs](../../general.md#network-bound-json-inputs). At publication acceptance, the relay MUST confirm that the signing device is in the current `AccountDeviceState`. Removing that device or expiry of its certificate after acceptance does not automatically invalidate the saved current profile.
