# Relay RPC notifications

[Relay RPC protocol](../README.md) · [Common method conventions](../methods/conventions.md)

## `device.status.changed`

An account's current home relay MAY send `device.status.changed` to other relays that recently queried the account's device-certificate status.

### Notification parameters

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `account` | string | Yes | The account whose device state changed |
| `device_id` | string | Yes | The device ID whose cache entry should be invalidated |

### Processing rules

The receiver MUST confirm that the sender is the relay designated by the account's current route; otherwise, it rejects the notification.

After validation, the receiver MUST invalidate the certificate-status cache for the corresponding `(account, device_id)` and call [`device.status`](../methods/account-queries.md#devicestatus) again as needed. It may invalidate local sessions on that basis only after obtaining and validating a fresh `inactive` result according to that method.

Duplicate hints MAY be coalesced while the cache is invalid and awaiting verification. Once the cache is repopulated, a hint with identical parameters must still invalidate it. If a new hint arrives during a query and cannot be confirmed as covered by that query, the query response MUST NOT restore a usable cache entry; another query SHOULD be made as needed. An invalidated cache MUST NOT be used for authorization.
