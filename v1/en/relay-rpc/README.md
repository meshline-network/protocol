# Relay RPC protocol

[Meshline Protocol 1.0](../README.md)

libp2p protocol ID: `/meshline/relay/1.0.0`

This protocol defines direct account queries and cross-relay message delivery between eligible public relays. Messages are not forwarded hop by hop along a DHT lookup path. After resolving the current account route, the source relay connects directly to the recipient's home relay. Source relay and target relay have the meanings given by the client–relay protocol's [role definitions](../client-relay/concepts/roles-and-routing.md#roles).

Connections, remote responses, caches, and the transport network are not roots of user trust. Responses that fail signature, route, or object validation MUST NOT be forwarded to clients.

## Protocol contents

| Part | Contents |
|---|---|
| [Common method conventions](methods/conventions.md) | In-stream message framing, JSON-RPC requests and responses, target routing, errors, and resource controls |
| [Account query methods](methods/account-queries.md) | Queries for device authorization status, complete device state, and account profiles |
| [Message delivery methods](methods/message-delivery.md) | Authorization, validation, timeline writes, and idempotent outcomes for cross-relay delivery |
| [Relay RPC notifications](notifications/README.md) | Invalidation hints for device-certificate status caches |

## Method index

- [`device.status`](methods/account-queries.md#devicestatus)
- [`device.state.resolve`](methods/account-queries.md#devicestateresolve)
- [`profile.resolve`](methods/account-queries.md#profileresolve)
- [`message.deliver`](methods/message-delivery.md#messagedeliver)

## Notification index

- [`device.status.changed`](notifications/README.md#devicestatuschanged)

## Conformance requirements

Compatible implementations must follow the [conformance testing boundaries](../test-vectors/README.md#conformance-testing-boundaries) and cover:

- Connections and transport: under the [common method conventions](methods/conventions.md), verify peer identity, length prefixes and receive limits, JSON-RPC envelopes, target selection, route refresh, and error recovery. Message-framing failures close or reset the stream without constructing an application-layer response.
- Queries and notifications: under the [account query methods](methods/account-queries.md) and [Relay RPC notifications](notifications/README.md), verify device status and invalidation hints, account and signature binding of cross-relay responses, and the permission differences between public profile queries and restricted device queries. Unverified remote responses MUST NOT be forwarded to clients as successful results.
- Reliable delivery: under [`message.deliver`](methods/message-delivery.md#messagedeliver), verify receipt authorization, idempotency over complete parameters, result retention, response loss, route migration, and delivery and result confirmation after restart.
