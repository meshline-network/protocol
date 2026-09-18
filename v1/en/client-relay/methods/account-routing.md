# Account Route Methods

[Client–relay protocol](../README.md) · [Account and device lifecycle](../concepts/account-and-device-lifecycle.md)

## `account.route.publish`

`account.route.publish` asks the currently connected relay to complete and publish an account-signed route. The caller MUST first prove control of the route's account through an account session.

| Item | Convention |
|---|---|
| HTTP | `PUT /meshline/v1/account/route/publish` |
| Session requirement | Account session |
| WSS | `account.route.publish` |
| HTTP success status | `200 OK` |

### Request Parameters

Parameters are the complete [`AccountRoute`](../../relay-dht/core-objects.md#accountroute) to publish, directly.

The account authenticated by the session MUST match the route's account. The route MUST designate the currently connected relay to serve that account, contain valid `account_signature`, and omit `relay_signature`.

### Response Object

Success returns `AccountRoute` with the relay signature appended. It means the connected relay has become the account's current home relay, persisted the final route, completed DHT PUT, and met its replica acknowledgment policy.

The client MUST confirm that the response only appends the relay signature to the submitted document and validate the final document under [AccountRoute validation rules](../../relay-dht/core-objects.md#validation-rules). Once verified, save it and its `revision`.

### Processing Rules

The relay MUST confirm it still locally stores valid authoritative state or unexpired current pre-stored device state for the account. Without usable state, it MUST return `state_conflict` and neither sign nor publish the route.

A request revision below the highest retained under [Route revisions and conflict resolution](../../relay-dht/core-objects.md#route-version-and-conflict-resolution) returns `stale_state`. Otherwise, different content from a known same-revision route, or failure to use a revision higher than a known conflict to resolve it, returns `state_conflict`. None of these requests may be signed or published.

Before acceptance, check `updated_at` under [AccountRoute validation](../../relay-dht/core-objects.md#validation-rules). A value beyond local Unix seconds plus allowed future deviation returns `clock_skew`, without signing, publishing, or changing stored routes, highest revision, or conflict state. Invalid time-field type or representation still returns `bad_request`.

Acceptance additionally requires that the final co-signed document's complete Canonical JSON UTF-8 encoding be at most 4 KiB (4,096 bytes), including the appended `relay_signature`, existing account signature, and all unknown properties. Exceeding this returns `request_too_large`, without publication or changes to stored routes, highest revision, or conflict state. Checking only the client's draft size is insufficient. Requests and responses each also meet transport size limits.

After checks pass, the relay MUST NOT modify existing request fields; it may only append `relay_signature`, persist the final document, and publish it to the DHT. Later replica maintenance follows [Republication and persistence](../../relay-dht/concepts/account-route-lifecycle.md#republication-and-persistence).

## `account.route.resolve`

`account.route.resolve` lets any requester query an account's current public route by complete account ID.

| Item | Convention |
|---|---|
| HTTP | `GET /meshline/v1/account/route/resolve` |
| Session requirement | None |
| WSS | `account.route.resolve` |
| HTTP success status | `200 OK` |

### Request Parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `account` | string | Yes | [Account ID](../core-objects/accounts-and-devices.md#account-id) to query |

### Response Object

Success returns the `AccountRoute` collected from the DHT, verified, and selected under [Route revisions and conflict resolution](../../relay-dht/core-objects.md#route-version-and-conflict-resolution). Clients and relays still independently verify it. Use of saved routes follows [`AccountRoute` validation rules](../../relay-dht/core-objects.md#validation-rules).

### Processing and Errors

An unresolved same-revision conflict not superseded by a higher revision returns `invalid_state`. With no such conflict and no valid record meeting the relay's persisted revision lower bound, return `not_found`, including when a newer route has expired and only lower-revision old routes can be found.
