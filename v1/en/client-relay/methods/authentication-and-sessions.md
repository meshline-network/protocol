# Session Authentication and Lifecycle

[Client–relay protocol](../README.md) · [Discovery and session concepts](../concepts/discovery-and-sessions.md)

## Session Authentication

### Relay Origin Calculation

Both `origin` in authentication signatures and session origin binding are calculated from the connection's target endpoint. For WSS, replace the scheme with `https`, preserving host and port, then produce the origin using the ASCII serialization rules of [RFC 6454](https://www.rfc-editor.org/rfc/rfc6454.html#section-6.2):

- The scheme is `https`. Domain names use lowercase ASCII; internationalized names become A-labels under [IDNA2008](https://www.rfc-editor.org/rfc/rfc5891.html#section-5). Preserve a trailing domain-name dot.
- IPv4 uses dotted decimal; IPv6 uses canonical hexadecimal under [RFC 5952 Section 4](https://www.rfc-editor.org/rfc/rfc5952.html#section-4), retaining brackets.
- Omit default port `443`; other ports use decimal without leading zeros.
- Include no userinfo, path, query, fragment, or trailing `/`.

Client signing, relay verification, and session-origin comparison MUST use the same result. For example, `https://RELAY.example:443/meshline/v1` and `wss://relay.example/meshline/v1` both yield `https://relay.example`. This conversion is only for origin; it does not rewrite `RelayDescriptor` or its signing input. The endpoint itself still must meet [address rules](../core-objects/relay-descriptor.md#relay-endpoint-addresses).

### `auth.challenge`

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/auth/challenge` |
| Session requirement | None |
| WSS | `auth.challenge` |
| HTTP success status | `200 OK` |

#### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `account` | string | Yes | [Account ID](../core-objects/accounts-and-devices.md#account-id) |

#### Response Object

Success returns a one-time challenge issued by the relay for the requested account; both verification methods below use its `nonce`. Clients MUST NOT use it to authenticate another account or at another relay. The relay generates both `created_at` and `expires_at`, letting clients observe relay time and estimate remaining validity. Neither response field enters device- or account-session signing input; device authentication still uses a client-generated `timestamp`:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `nonce` | string | Yes | Relay-generated one-time challenge consumed on the first verification attempt; a complete encoding of a cryptographically secure random 32-byte value; nonempty, at most 256 visible ASCII characters (`U+0021` through `U+007E`) |
| `created_at` | integer | Yes | Current Unix seconds when generated, exposing relay time to the client |
| `expires_at` | integer | Yes | Challenge expiry in Unix seconds on the same relay clock as `created_at`; MUST be later than `created_at` |

```json
{"nonce":"base64url...","created_at":1730000000,"expires_at":1730000300}
```

#### Processing Rules

After validating the account ID, the relay generates `nonce` and binds it to the account and expiry. A challenge may be submitted to either `auth.device.verify` or `auth.account.verify`; the relay establishes the mode corresponding to the invoked verification interface and successfully verified proof.

Returned `expires_at` MUST match the expiry used in verification. Both methods first check nonce account binding, consumption, and expiry. It expires when relay time reaches `expires_at`; missing, expired, or consumed challenges return `unauthorized`.

A known nonce MUST be consumed on the first verification attempt, regardless of success or failure.

### `auth.device.verify`

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/auth/device/verify` |
| Session requirement | None |
| WSS | `auth.device.verify` |
| HTTP success status | `200 OK` |

#### Request Parameters

Parameters prove possession of the specified device's Ed25519 private key and bind the proof to the target relay ID, origin, and current nonce. The relay verifies this proof and current device validity under the [processing rules](#processing-rules-1):

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `nonce` | string | Yes | MUST exactly equal the unconsumed, unexpired `nonce` from the corresponding `auth.challenge` response |
| `timestamp` | integer | Yes | Current Unix seconds when the client constructs the authentication proof |
| `signer_certificate` | DeviceCertificate | Yes | Both signatures MUST be valid; `account` MUST exactly equal the challenge request's `account`; the relay derives the device ID and confirms current validity under the [processing rules](#processing-rules-1) |
| `device_signature` | string | Yes | 64-byte Ed25519 signature over the device-session authentication input below, unpadded base64url |

##### Device Session Authentication Signing Input

For request `device_signature`, the client constructs this `auth_payload`. It is used only to generate and verify signatures, not transmitted:

```json
{
  "$type": "meshline.relay.auth",
  "relay_id": "0x1234567890abcdef1234567890abcdef12345678",
  "origin": "https://relay.example",
  "account": "neo:860833102:...",
  "device_id": "dev_...",
  "nonce": "base64url...",
  "timestamp": 1730000000
}
```

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.relay.auth` |
| `relay_id` | string | Yes | Relay ID |
| `origin` | string | Yes | Target origin calculated under [Relay origin](#relay-origin-calculation) |
| `account` | string | Yes | MUST equal the corresponding challenge request's `account` |
| `device_id` | string | Yes | Derived from request `signer_certificate` under [Device ID](../core-objects/accounts-and-devices.md#device-id) |
| `nonce` | string | Yes | Exact copy of the corresponding challenge response's `nonce` |
| `timestamp` | integer | Yes | Current Unix seconds when constructing the proof; copied unchanged into request `timestamp` |

Signing input is `network_bound_json_bytes(auth_payload)`, which adds trusted `$context` and produces Canonical JSON UTF-8 bytes under [Network-bound JSON inputs](../../general.md#network-bound-json-inputs). The client signs the resulting bytes with the device Ed25519 private key.

#### Response Object

Success returns [`SessionCredentials`](#sessioncredentials) with `mode` equal to `device`. Enabling timeline notifications follows [`message.timeline.changed`](../notifications/README.md#messagetimelinechanged).

#### Processing Rules

First check and consume the nonce under [`auth.challenge` processing](#processing-rules), then check client `timestamp` against local clock policy, returning `clock_skew` for excessive deviation or `bad_request` for invalid field type or representation. Then verify request `device_signature` with the certificate's signing public key under [Device session authentication signing input](#device-session-authentication-signing-input).

If the currently connected relay serves this account, it reads local authoritative state directly. Otherwise it calls [`device.status`](../../relay-rpc/methods/account-queries.md#devicestatus) on the account's current home relay with only that method's query parameters; the currently connected relay still verifies the authentication proof itself. Queried account and device MUST match this authentication. Response verification and caching follow that method. No session may be established without confirming current device validity.

Device-authentication time checks detect client/relay clock differences before business calls. Clients should use the same time basis for authentication and later requests. After [`clock_skew`](conventions.md#error-codes), clients may consult `auth.challenge.created_at` or `relay.info.server_time` to assess deviation. If retrying, they MUST obtain a new challenge and sign a new proof.

### `auth.account.verify`

| Item | Convention |
|---|---|
| HTTP | `POST /meshline/v1/auth/account/verify` |
| Session requirement | None |
| WSS | `auth.account.verify` |
| HTTP success status | `200 OK` |

#### Request Parameters

Parameters prove possession of the account private key. The request MUST include its public key so even a relay without saved account device state can check account derivation under [Account ID](../core-objects/accounts-and-devices.md#account-id) and verify the signature under [Account signature rules](../../general.md#account-signatures):

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `nonce` | string | Yes | MUST exactly equal the unconsumed, unexpired `nonce` from the corresponding challenge response |
| `account_public_key` | string | Yes | Account public key, unpadded base64url, represented under [Account signatures](../../general.md#account-signatures); the [derived account ID](../core-objects/accounts-and-devices.md#account-id) MUST exactly equal the challenge request's `account` |
| `account_signature` | string | Yes | Signature by the account private key over the input below under [Account signature rules](../../general.md#account-signatures), unpadded base64url |

##### Account Session Authentication Signing Input

For request `account_signature`, the client constructs this `auth_payload`. It is used only to generate and verify signatures, not transmitted:

```json
{
  "$type": "meshline.relay.account_auth",
  "relay_id": "0x1234567890abcdef1234567890abcdef12345678",
  "origin": "https://relay.example",
  "account": "neo:860833102:...",
  "account_public_key": "base64url...",
  "nonce": "base64url..."
}
```

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.relay.account_auth` |
| `relay_id` | string | Yes | Relay ID |
| `origin` | string | Yes | Target origin calculated under [Relay origin](#relay-origin-calculation) |
| `account` | string | Yes | Account requesting the session; MUST exactly equal `account` in the corresponding challenge request |
| `account_public_key` | string | Yes | Exact copy of request `account_public_key` |
| `nonce` | string | Yes | Exact copy of the corresponding challenge response's `nonce` |

Signing input is `network_bound_json_bytes(auth_payload)`, which adds trusted `$context` and produces Canonical JSON UTF-8 bytes under [Network-bound JSON inputs](../../general.md#network-bound-json-inputs). The client signs these bytes under [Account signature rules](../../general.md#account-signatures).

#### Response Object

Success returns [`SessionCredentials`](#sessioncredentials) with `mode` equal to `account`.

#### Processing Rules

Check and consume the nonce under [`auth.challenge` processing](#processing-rules). Determine chain and network from the corresponding challenge request's `account`, verify `account_public_key` binding to that account, and verify request `account_signature` under [Account session authentication signing input](#account-session-authentication-signing-input).

## Session Credentials and Lifecycle

### `SessionCredentials`

Both successful `auth.device.verify` and `auth.account.verify` return `SessionCredentials`:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `token` | string | Yes | Relay-issued bearer credential, valid only for its issuing origin, account, and mode; device sessions also bind device ID |
| `mode` | string | Yes | Established mode: `auth.device.verify` MUST return `device`, and `auth.account.verify` MUST return `account` |
| `expires_at` | integer | Yes | Session expiry in Unix seconds; the relay chooses its period under deployment policy and returns the exact value. Device sessions MUST NOT outlive the latest device certificate confirmed in this authentication |

The device-session certificate expiry cap comes from current device state used in this authentication. The account's home relay uses the latest certificate's `expires_at` in local authoritative state; other relays use `expires_at` in a verified `active` result from `device.status`, including cached results still allowed for authentication under its rules. When an older certificate proves the same device identity, the cap still uses the confirmed latest certificate, not the attached older certificate's period. The same cap applies to new device sessions established by WebSocket renewal. Account-session expiry is chosen by the relay.

Tokens MUST provide at least 128-bit resistance to guessing and forgery. Generating at least 16 random bytes per new session from a cryptographically secure source and encoding them completely as `token` is recommended. Tokens MUST be nonempty strings of at most 256 visible ASCII characters (`U+0021` through `U+007E`). They are case-sensitive. Clients MUST preserve and use them completely as opaque values, without extracting time, account, device, or route data. An issuing relay MUST NOT reuse a token among session records still valid or retained for replay prevention.

Clients MUST confirm the response mode matches the request; a token returned with another mode MUST NOT be used or cached. Clients MUST also prevent token disclosure and MUST NOT send it to other relays.

### Session Validity and Connection Binding

A device session is the relay's short-term judgment of device state at establishment. During its lifetime the relay may accept it without re-querying device state for every request. Renewing the same device ID with the same keys and a new certificate may leave existing sessions valid until their original `expires_at`; certificate renewal does not automatically extend sessions. New sessions likewise require only that the device ID remain valid in latest authoritative state.

Once the establishing relay learns that a device was removed, its keys changed, or its latest certificate became invalid, it MUST immediately invalidate all related local device sessions and stop dependent pushes and subscriptions. A relay unaware of the change may continue accepting established sessions until expiry or revalidation on a rebuilt WebSocket connection. Short-lived `active` caching may also permit new sessions until cache expiry or discovery of new state.

Each new WebSocket connection MUST perform `auth.challenge` and the selected mode's verification method before session-requiring calls. It MUST NOT bind an old session to the new connection using a previous connection's token. Unauthenticated connections may call only authentication interfaces and public reads. Once a mode is bound, the account, device, and mode cannot be rebound, though same-connection renewal is allowed below. Only device-session connections may establish subscriptions.

HTTP uses tokens as bearer credentials across requests; underlying connection changes do not alter session validity. Every request still must pass session validity, mode, method permission, and business checks.

### WebSocket Session Renewal

While the current session remains valid, clients may call `auth.challenge` and the same mode's verification method again on the original WebSocket connection. The challenge account, proof account, and mode MUST match the bound identity; device sessions MUST retain the same device ID. Rebinding attempts return `forbidden`. Renewal uses a new challenge and all authentication rules, including device timestamp checks, current device-state determination, and cache constraints; the old session alone cannot extend validity.

The original session MUST still be valid when renewal takes effect. After successful authentication, the relay establishes a new session and token, returns `SessionCredentials`, replaces the connection binding, and uses the new response's `expires_at`. The old token's expiry is not extended. Still-valid notification enablement, channel subscriptions, and group subscriptions remain; group device access intervals are not rebuilt, and synchronization positions do not reset. Renewal itself does not require resubscription or catch-up; synchronization requirements from other state changes or lost notifications still apply.

Failed authentication returns the applicable error, without extending the old session or changing the original binding or still-valid subscriptions merely because of that failure. The old session remains usable within its own validity. If authentication reveals device invalidity, related sessions and subscriptions MUST still be revoked immediately. Once the original session expires or is revoked, renewal or reauthentication on that connection is forbidden and returns `unauthorized`; the client MUST reconnect and authenticate. Starting renewal does not pause original-session expiry checks.
