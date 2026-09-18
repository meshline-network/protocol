# Device State Methods

[Client–relay protocol](../README.md) · [Common method conventions](conventions.md) · [Account profiles and device certificates](../core-objects/accounts-and-devices.md) · [Account and device lifecycle](../concepts/account-and-device-lifecycle.md)

## `device.state.publish`

`device.state.publish` submits a complete [`AccountDeviceState`](../core-objects/accounts-and-devices.md#accountdevicestate) to a relay.

| Item | Convention |
|---|---|
| HTTP | `PUT /meshline/v1/device/state/publish` |
| Session requirement | Device or account session |
| WSS | `device.state.publish` |
| HTTP success status | `200 OK` |

### Request Parameters

Parameters are the complete `AccountDeviceState` directly. It MUST belong to the calling account.

### Response Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `status` | string | Yes | Result: `accepted` when successfully accepted by the current home relay, or `staged` when pre-stored by a non-home relay |
| `staged_until` | integer | Conditional | MUST be present for `staged`, specifying the pre-stored state's retention deadline in Unix seconds; MUST be omitted for `accepted` |

### Processing Rules

#### Authoritative State Updates

The current home relay validates complete state under [`AccountDeviceState`](../core-objects/accounts-and-devices.md#accountdevicestate). With no existing state, it accepts valid complete state. Otherwise, a valid higher revision replaces current state, a lower revision returns `stale_state`, and an equal revision with different complete content returns `state_conflict` without overwriting. Compare complete content by [Canonical JSON](../../general.md#canonical-json).

When accepting new authoritative state, the relay handles device sessions under [Session rules](authentication-and-sessions.md#session-validity-and-connection-binding) and sends `device.state.changed` to still-valid devices. `staged` changes no current permissions and sends no notification.

#### Pre-Stored State Handling

A non-home relay may refuse pre-storage. If it accepts, it MUST NOT use that state for device authentication or public device queries until a valid route designates it the current home relay. Existing pre-stored state for the same account follows the same revision comparison rules.

A valid higher revision replaces the old pre-stored state and recalculates `staged_until` from this acceptance time. The relay need retain only the current pre-stored state through its returned deadline and may delete it afterward.

#### Duplicate Submissions

A repeated submission with equal revision and identical complete content, after passing this method's checks, creates no new revision and returns the latest handling result: `staged` with the original `staged_until` while still within pre-storage retention, or `accepted` without `staged_until` once accepted as authoritative by the current home relay. The same accepted state does not trigger another `device.state.changed`.

## `device.state.resolve`

`device.state.resolve` reads a target account's complete `AccountDeviceState`, supporting own-state reads, public queries, and credential-authorized signed queries. Own-state reads allow device or account sessions; other-account reads require a device session.

Clients should cache complete state and are advised to read their own state on returning online. Handle [`device.state.changed`](../notifications/README.md#devicestatechanged) under that notification's rules.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/device/state/resolve`<br>`POST /meshline/v1/device/state/resolve` |
| Session requirement | Device or account session |
| WSS | `device.state.resolve` |
| HTTP success status | `200 OK` |

### Request Parameters

#### Read by Account

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `account` | string | Yes | Target [account ID](../core-objects/accounts-and-devices.md#account-id) whose devices are requested |

A missing account, explicit `null`, empty string, or malformed value returns `bad_request`. GET does not accept signed-query-only fields; their presence returns `bad_request`, without ignoring them and performing a public query.

For the calling account, a device or account session authorizes the read, made only to its current home relay. For another account, a device session is required and the call is a public query, which may be forwarded by the currently connected relay to the target's home relay. The target MUST enable public discovery. This form carries no request certificate, request signature, or access credential.

#### Signed Queries

Signed queries require a device session, are signed by the calling device, and carry a contact grant or invitation to read another account's devices. For cross-relay reads, the same complete request becomes inter-relay `device.state.resolve` `params`.

HTTP POST MUST submit complete signed-query parameters. WebSocket without signed-query-only fields performs a read by account; presence of any of `$type`, `authorization`, `signer_certificate`, `created_at`, or `device_signature` requires validating the complete signed query. Missing parameter objects, required account fields, or other required fields return `bad_request`. Missing fields, invalid signatures, or invalid credentials MUST NOT cause fallback to own-state reads or public queries.

Signing input follows [Network-bound JSON inputs](../../general.md#network-bound-json-inputs).

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `$type` | string | Yes | Fixed as `meshline.device.state.resolve` |
| `account` | string | Yes | Target [account ID](../core-objects/accounts-and-devices.md#account-id) |
| `authorization` | [ContactGrant](../concepts/contacts.md#contactgrant) or [ContactInvite](../concepts/contacts.md#contactinvite) | Yes | Valid grant from the target to the requester, or valid invitation signed by a currently valid target-account device |
| `signer_certificate` | DeviceCertificate | Yes | Request signer's certificate; the currently connected relay MUST confirm it identifies the calling device; the target MUST validate it under [`DeviceCertificate`](../core-objects/accounts-and-devices.md#devicecertificate) |
| `created_at` | integer | Yes | Unix seconds when the requesting device creates this request; relays may apply local freshness policy |
| `device_signature` | string | Yes | 64-byte Ed25519 signature by the certificate's device over current request parameters excluding this field, unpadded base64url |

### Response Object

Every form returns the requested account's complete current [`AccountDeviceState`](../core-objects/accounts-and-devices.md#accountdevicestate). Callers MUST validate the complete state under its definition and confirm `account` matches the original request.

Clients and forwarding relays MUST perform these checks against verified state within the same trusted network context and target account, without separate revision histories for different authorization forms or responding relays. Reject lower `revision`; accept equal revisions only with identical complete-state Canonical JSON; update known state for higher revisions only after object and signature validation. Unverified state MUST NOT alter known revision, and rejected responses MUST NOT select devices or be passed on as valid success.

For invitation queries, the caller MUST additionally locate the currently valid invitation signer in returned state and verify the same `ContactInvite`'s target account, signature, and validity period.

To send messages, callers then select devices whose certificate validity includes the current time from this verified complete state.

### Processing and Errors

All calls require a valid session. Missing, expired, or invalid sessions return `unauthorized`; using an account session to read another account or make a signed query returns `forbidden`.

After authorization, an account without established device state returns `not_found`. Existing state with an empty device array still returns success with complete `AccountDeviceState`. Reads change no device state.

#### Own-State Reads

The relay uses the device or account session to confirm that the target is the calling account and that it still serves it. A known valid current route pointing elsewhere returns `route_stale`; undetermined current home returns `target_not_local`. Own-state reads go only to the home relay, require no public discovery, and are not forwarded. Removed devices cannot use old device sessions to read new state. Account key holders may establish an [account session](../concepts/discovery-and-sessions.md#session-modes) to read their own state for adding devices or recovery.

#### Public Queries

For public queries of another account, the source first verifies the device session, then handles a local target or forwards the request containing the target account as inter-relay `device.state.resolve` `params`. The target home relay MUST confirm that current profile public discovery is enabled, otherwise return `forbidden`. Cross-relay public queries carry no requesting-device certificate or signature. The target neither verifies client sessions nor queries requesting-device state; it exposes state only under public access conditions and does not treat this as own-account authorization.

#### Signed Queries

The currently connected relay MUST confirm that `signer_certificate` identifies the calling device and verify request certificate, signature, and account binding. This is the requesting-device authorization decision for this read. For cross-relay calls, the target re-verifies certificate, signature, account binding, and access credentials, but neither verifies the client session nor re-queries requesting-device state for the same read. Invalid request structure returns `bad_request`; invalid certificate, request, or invitation signatures return `invalid_signature`; signed own-state queries or credentials lacking device-query permission return `forbidden`.

The currently connected relay may apply its own freshness policy to `created_at`; the cross-relay target independently applies its own policy. Too-future or too-old timestamps failing the check return `clock_skew`; the client checks its time and generates and signs a new query. Target `clock_skew` MUST be returned with the error mapping for the client's transport.

For [`ContactInvite`](../concepts/contacts.md#contactinvite), the target MUST confirm issuance by the target account, locate its valid signing device in current `AccountDeviceState`, and verify the signature with that device's signing public key. `expires_at` MUST be later than verification time. Public discovery and an established contact relationship are not required. Invalid invitation signatures return `invalid_signature`; wrong invitation account, expiry, or an invalid signing device returns `forbidden`. Invalid invitations MUST NOT fall back to public queries.
