# Account query methods

[Relay RPC protocol](../README.md) · [Common method conventions](conventions.md)

## `device.status`

`device.status` queries an account's current home relay for the current authorization status of a specified device, primarily for authorization checks before another relay establishes a device session. A business request already authorized by a device session at the source relay does not call this method again for the same operation.

### Request parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `account` | string | Yes | [Account ID](../../client-relay/core-objects/accounts-and-devices.md#account-id); also the target account of this call |
| `device_id` | string | Yes | [Device ID](../../client-relay/core-objects/accounts-and-devices.md#device-id) derived from the target device's `DeviceCertificate` |

### Response object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `status` | string | Yes | The device's certificate authorization result in the account's current authoritative state; `active` means the device certificate is currently valid, and `inactive` means the device currently has no valid authorization |
| `expires_at` | integer | Conditional | MUST be present when `status` is `active`, equal to the expiry Unix seconds of the device's latest certificate in current state; MUST be omitted when `status` is `inactive` |

### Processing and caching rules

The target relay may answer only from its locally held current `AccountDeviceState`; another relay's cache MUST NOT serve as an authoritative result. It returns `active` only when current state contains a latest certificate matching the device ID, both signatures are valid, and the current time falls within its validity period. All other cases return `inactive`, without distinguishing never-existing, removed, not-yet-valid, or expired certificates.

The caller MUST confirm that the authenticated peer is the account's current home relay and correlate the result with the original request under the [response correlation rules](conventions.md#requests).

The calling relay MAY use verified results under a locally bounded caching policy. The cache MUST preserve the binding to the requested account, device, and authenticated peer, and cannot serve as a result for another account, device, or home relay. It MUST expire after that bounded window; a cached `active` result MUST also expire at its `expires_at`. Once newer state is learned, use of the old cache MUST stop.

The caller MAY use an old certificate for the same device ID to verify device public-key bindings and signatures in historical or in-flight objects. Current permissions depend only on whether that device ID remains valid in the latest authoritative state; the complete contents of the old and latest certificates need not be identical.

## `device.state.resolve`

`device.state.resolve` obtains the target account's current complete device state so that the caller can select currently valid recipient devices and generate key boxes.

### Request parameters

This method accepts two request forms:

- Public query: `params` MUST explicitly contain the target `account`, as defined by [reading by account](../../client-relay/methods/device-state.md#read-by-account) for client–relay `device.state.resolve`; it carries no request certificate, request signature, or access credential.
- Signed query: use the [complete signed request](../../client-relay/methods/device-state.md#signed-queries) of client–relay `device.state.resolve`, with `account` specifying the target account. The source relay MUST NOT reconstruct, remove, or rewrite fields.

Query-form recognition and completeness validation follow the client–relay `device.state.resolve` [WebSocket query rules](../../client-relay/methods/device-state.md#signed-queries). Self-read is used only between a client and its home relay and does not apply to this method.

### Response object

The response object and caller validation requirements both follow the response rules of client–relay [`device.state.resolve`](../../client-relay/methods/device-state.md#devicestateresolve).

### Processing and errors

When accepting a client request, the source relay MUST confirm that the device session is still valid.

#### Public queries

For a public query, the target relay MUST confirm that the current profile enables public discovery; otherwise, it returns `forbidden`. It does not validate the client session or query the requesting device's status. An inter-relay request carrying only an account ID is always authorized as a public query; it does not inherit self-read permission granted to a client through a device session at its home relay.

#### Signed queries

For a signed query, the source relay MUST additionally confirm that the request certificate corresponds to the calling device and account, and verify both the request certificate and request signature. This check determines the requesting device's authorization for this read; later device-state changes do not retroactively affect the accepted request. The target relay MUST independently verify the signing device certificate, request signature, and account binding. The request signature is verified using that certificate's `signing_public_key`. The target relay does not query or determine the requesting device's current status again.

For a signed query, the target relay validates access credentials as specified by client–relay [`device.state.resolve`](../../client-relay/methods/device-state.md#devicestateresolve).

#### Errors and routing

Errors from business validation and `created_at` freshness checks follow the processing rules of client–relay [`device.state.resolve`](../../client-relay/methods/device-state.md#devicestateresolve). The source relay returns the target relay's errors to the client using the error mapping for the client's transport. Account-route changes follow the [account routing rules](conventions.md#target-relay-selection-and-route-refresh); other errors follow the [error response rules](conventions.md#error-responses).

## `profile.resolve`

`profile.resolve` obtains the specified account's currently valid `AccountProfile`.

### Request parameters

The parameters are the complete request parameters of client–relay [`profile.resolve`](../../client-relay/methods/profiles.md#profileresolve), with `account` specifying the target account.

### Response object

The response object and caller validation requirements both follow the response rules of client–relay [`profile.resolve`](../../client-relay/methods/profiles.md#profileresolve).

### Processing and errors

When accepting a client request, the source relay MUST confirm that the device session is still valid. The target relay does not validate the client session, query the requesting device's status, or validate contact authorization.

Home-relay responsibility checks, parameter errors, nonexistent profiles, and response verification follow the processing rules of client–relay [`profile.resolve`](../../client-relay/methods/profiles.md#profileresolve). The source relay returns the target relay's errors using the error mapping for the client's transport. Account-route changes follow the [account routing rules](conventions.md#target-relay-selection-and-route-refresh); other errors follow the [error response rules](conventions.md#error-responses).
