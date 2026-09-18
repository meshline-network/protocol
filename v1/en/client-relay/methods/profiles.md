# Account Profile Methods

[Client–relay protocol](../README.md) · [Common method conventions](conventions.md) · [Account profiles and device certificates](../core-objects/accounts-and-devices.md) · [Account and device lifecycle](../concepts/account-and-device-lifecycle.md)

## `profile.publish`

`profile.publish` asks the current home relay to store a profile snapshot signed by the device used for this publication, for other accounts to read.

| Item | Convention |
|---|---|
| HTTP | `PUT /meshline/v1/profile/publish` |
| Session requirement | Device session |
| WSS | `profile.publish` |
| HTTP success status | `204 No Content` |

### Request Parameters

Parameters are the complete `AccountProfile` directly. It MUST belong to the calling account.

### Response Object

None. Success means the relay has persisted the profile and the device certificate used to verify its signature.

### Processing Rules

The relay MUST confirm publisher account and signing device through the device session and validate the document under [Account profile](../core-objects/accounts-and-devices.md#accountprofile).

It MUST check the complete profile against the [`AccountProfile`](../core-objects/accounts-and-devices.md#accountprofile) 8 KiB Canonical JSON limit. Exceeding it returns `request_too_large`, without saving or replacing the stored profile.

Before acceptance, it MUST compare `updated_at` with local Unix seconds. A value beyond local time plus the allowed future deviation returns `clock_skew`, without replacement. Invalid time-field type or representation returns `bad_request`.

Compare profile recency for one account by `updated_at`: valid larger values replace current profiles; smaller values return `stale_state`. Equal values use actual acceptance order, with later accepted valid profiles replacing earlier ones.

## `profile.resolve`

`profile.resolve` reads a target profile by complete account ID, without target authorization or a contact relationship. Client calls still require a valid device session solely for relay access and resource control.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/profile/resolve` |
| Session requirement | Device session |
| WSS | `profile.resolve` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `account` | string | Yes | Target [account ID](../core-objects/accounts-and-devices.md#account-id) whose profile is requested |

### Response Object

Returns the profile and its signing device certificate:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `profile` | AccountProfile | Yes | Target account's currently selected valid profile |
| `signer_certificate` | DeviceCertificate | Yes | Certificate used to verify the profile at publication acceptance; device validity was confirmed then and need not persist in current state at read time |

Callers MUST independently verify `signer_certificate` under [`DeviceCertificate`](../core-objects/accounts-and-devices.md#devicecertificate) signature and account-binding rules, use its device signing public key to verify the profile signature, and confirm `profile.account` matches the original request's `account`.

### Processing and Errors

Missing account, explicit `null`, empty string, or malformed account values return `bad_request`.

All calls require valid device sessions. Missing, expired, or invalid sessions return `unauthorized`; incorrect mode returns `forbidden`.

The source first verifies the device session, then handles a local target under its current route or forwards the request containing target `account` as inter-relay `profile.resolve` `params`.

The destination MUST confirm it remains the target's current home relay. A known valid current route pointing elsewhere returns `route_stale`; undetermined current home returns `target_not_local`. Own-account and other-account queries both follow [Target routing and refresh rules](../../relay-rpc/methods/conventions.md#target-relay-selection-and-route-refresh). Old profiles from a non-home relay MUST NOT serve as current authoritative responses.

A missing target profile returns `not_found`; otherwise return the complete profile and its signer certificate. Reading changes no profile or account state and grants neither complete-device-set queries nor message delivery permission.
