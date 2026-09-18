# Client–Relay Protocol

[Meshline Protocol 1.0](../README.md)

Meshline clients use this protocol through HTTPS or WSS endpoints verified against the Registry and `RelayDescriptor`. Every public relay provides the base module. Channel and group hosting are optional modules sharing the same transport, sessions, errors, and method namespace.

WebSocket follows [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455); WSS methods and notifications use [JSON-RPC 2.0](https://www.jsonrpc.org/specification) envelopes. For shared encoding and signing inputs, see the [General protocol rules](../general.md).

An account is a long-lived blockchain identity controlled by its account key holder. A device is a client instance with independent signing and encryption keys. The calling device is the account device actually used by the client for this call, whose identity the relay confirms through a valid device session. The account's selected current home relay stores its authoritative device state, profile, and bounded-retention message timeline, and accepts its `message.send` calls. A client may query other accounts' profiles and devices through its currently connected relay. For cross-relay messaging, the sender account's home relay resolves the target account's route, then delivers directly to the target home relay over relay RPC.

Clients do not participate in the relay DHT. Channel and group operations connect directly to the hosting relay specified by the reference and do not use account routes or account message timelines. A relay providing a hosting service MUST implement its entire module and publish the corresponding capability declaration in a valid `RelayDescriptor`. See [Roles, routing, and trust boundaries](concepts/roles-and-routing.md) for details.

## Protocol Contents

### Concepts and Core Objects

| Section | Contents |
|---|---|
| [Roles, routing, and trust boundaries](concepts/roles-and-routing.md) | Fundamental entities, calling and routing roles, request routing model, and trust boundaries |
| [Discovery and sessions](concepts/discovery-and-sessions.md) | Relay discovery, session modes, and session trust boundaries |
| [Account and device lifecycle](concepts/account-and-device-lifecycle.md) | Account setup, device changes and recovery, local route validation, and home relay migration |
| [Contacts and authorization](concepts/contacts.md) | Contact bootstrapping, relationship state, authorization objects, and synchronization within an account |
| [Message delivery](concepts/message-delivery.md) | Delivery process, results, idempotency, retention, and retries |
| [Account message timeline](concepts/message-timeline.md) | Timeline model, device visibility, retention and history gaps, record structure, and processing flow |
| [Core objects](core-objects/README.md) | Relay identity, account identity, device state, profiles, message envelopes, plaintext messages, and content references shared across methods |

### Methods and Notifications

| Section | Contents |
|---|---|
| [Common method conventions](methods/conventions.md) | HTTP/WSS request mapping, common responses, and errors |
| [Relay discovery and information methods](methods/relay-information.md) | Descriptor retrieval, service information, and limit queries |
| [Session authentication and lifecycle](methods/authentication-and-sessions.md) | Device and account authentication, session credentials, validity, and renewal |
| [Device state methods](methods/device-state.md) | Publication and pre-storage, own-state reads, public queries, and signed queries |
| [Account profile methods](methods/profiles.md) | Profile publication, queries, and signature verification |
| [Account route methods](methods/account-routing.md) | Route co-signing, publication, and queries |
| [Message methods](methods/messaging.md) | Message sending, delivery status queries, and timeline synchronization calls |
| [Notifications](notifications/README.md) | WebSocket Notification envelopes and catch-up after disconnection |

## Optional Modules

| Protocol component | Required relay declaration |
|---|---|
| [Channel hosting protocol](channels/README.md) | `channel.host.v1` |
| [Group hosting protocol](groups/README.md) | `group.host.v1` |

Unrecognized capability declarations MUST be ignored.

## Client Calls

Match a `method` name as a complete, case-sensitive string against its module's method index. Base-module methods are listed here; `channel.*` and `group.*` methods are listed in the respective module's Method Index.

The HTTP column lists GET, POST, PUT, PATCH, or DELETE for each method. `N/A` means that transport is unavailable. `JSON-RPC` in the WebSocket column means a client may call the method as a JSON-RPC Request on a WSS endpoint. The Session mode column specifies only the relay session mode required before calling the method; None means no relay session is required. A relay without a WSS endpoint provides only the forms defined in the HTTP column and sends no server notifications.

| Method | HTTP | WebSocket | Session mode |
|---|---|---|---|
| [`relay.descriptor`](methods/relay-information.md#relaydescriptor) | GET | JSON-RPC | None |
| [`relay.info`](methods/relay-information.md#relayinfo) | GET | JSON-RPC | None |
| [`auth.challenge`](methods/authentication-and-sessions.md#authchallenge) | POST | JSON-RPC | None |
| [`auth.device.verify`](methods/authentication-and-sessions.md#authdeviceverify) | POST | JSON-RPC | None |
| [`auth.account.verify`](methods/authentication-and-sessions.md#authaccountverify) | POST | JSON-RPC | None |
| [`device.state.publish`](methods/device-state.md#devicestatepublish) | PUT | JSON-RPC | Device or account session |
| [`device.state.resolve`](methods/device-state.md#devicestateresolve) | GET, POST | JSON-RPC | Device or account session |
| [`profile.publish`](methods/profiles.md#profilepublish) | PUT | JSON-RPC | Device session |
| [`profile.resolve`](methods/profiles.md#profileresolve) | GET | JSON-RPC | Device session |
| [`account.route.publish`](methods/account-routing.md#accountroutepublish) | PUT | JSON-RPC | Account session |
| [`account.route.resolve`](methods/account-routing.md#accountrouteresolve) | GET | JSON-RPC | None |
| [`message.send`](methods/messaging.md#messagesend) | POST | JSON-RPC | Device session |
| [`message.delivery.status`](methods/messaging.md#messagedeliverystatus) | GET | JSON-RPC | Device session |
| [`message.timeline.sync`](methods/messaging.md#messagetimelinesync) | GET | JSON-RPC | Device session |

Mapping request parameters to the HTTP body, HTTP query, or WebSocket `params`, and handling responses and errors, follow the [Common method conventions](methods/conventions.md).

## Server Notifications

Server notifications are sent only over WebSocket as JSON-RPC Notifications without `id`; HTTP has no equivalent. Base-module notifications are listed here, while channel and group notifications appear in their respective Notification Indexes.

| Notification | Sending precondition |
|---|---|
| [`device.state.changed`](notifications/README.md#devicestatechanged) | The account's current home relay has accepted new authoritative device state, and the current connection remains valid |
| [`message.timeline.changed`](notifications/README.md#messagetimelinechanged) | The device has authenticated on a WebSocket connection to the account's current home relay, and the account message timeline head may have changed |

For JSON-RPC envelopes and connection lifecycle, see [Client–relay notifications](notifications/README.md).

## Conformance Requirements

Conforming implementations MUST follow the [Conformance testing boundaries](../test-vectors/README.md#conformance-testing-boundaries) and verify the behavior specified in the text under these topics:

- Fundamental objects: verify encoding, types, network and identity binding, nested signatures, message AAD, and authenticated and safe handling of bodies and attachments under the [General protocol rules](../general.md) and [Core objects](core-objects/README.md).
- Discovery and sessions: verify [Relay discovery](concepts/discovery-and-sessions.md), [Descriptors and endpoints](core-objects/relay-descriptor.md), and [Authentication and renewal](methods/authentication-and-sessions.md), including candidate rejection, relay_id and origin binding, both session modes, challenge consumption and expiry, device invalidation, and connection switching.
- Devices and profiles: verify pre-stored and authoritative state, revision rollback prevention and conflicts, duplicate submissions, cache isolation, account recovery, and cross-relay response validation under [Device state methods](methods/device-state.md) and [Account profile methods](methods/profiles.md). Public profile reads do not relax device-query or message-delivery permissions.
- Contacts: verify public or invitation bootstrapping, relationship establishment and deletion, grant selection and endorsement merging, grant maintenance after device changes, and synchronization of account-internal snapshots, record revisions, and deletion records under [Contacts and authorization](concepts/contacts.md).
- Routing and migration: verify [Route publication and resolution](methods/account-routing.md) and [Home relay changes](concepts/account-and-device-lifecycle.md#home-relay-changes), including an unreachable previous relay, device-state pre-storage, existing delivery responsibilities and result queries, catching up on old timelines, and continuing sequence numbers after migrating back.
- Message delivery: verify self, local, and cross-relay delivery, recipient authorization, partial or total device invalidity, both key-box sets, complete parameter comparison, result states and retention periods, and recovery after lost responses or restarts under [Delivery, idempotency, and retries](concepts/message-delivery.md).
- Timelines and notifications: verify device visibility, page ordering and end indicators, history gaps, persistence of timeline heads, synchronization cursor advancement, and notification coalescing, loss, and new hints during reads under [Account message timeline](concepts/message-timeline.md), [Message methods](methods/messaging.md), and [Notification rules](notifications/README.md). Device-state change notifications that carry no state MUST also follow [Device state change notifications](notifications/README.md#devicestatechanged).
- Transports and errors: verify equivalent HTTP/WSS parameters and results, parameterless calls, JSON envelopes, session permissions, pagination, time and resource boundaries, integer exhaustion, error mapping, and rate-limit backoff under [Common method conventions](methods/conventions.md).
