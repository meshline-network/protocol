# Roles, Routing, and Trust Boundaries

[Client–relay protocol](../README.md)

## Roles

### Fundamental Entities

**Account**
A long-lived blockchain address identity in Meshline, controlled by its account key holder. See [Account ID](../core-objects/accounts-and-devices.md#account-id) for its canonical identifier. Account keys authorize devices and sign account routes; they are not used for everyday message encryption.

**Device**
A client instance authorized by an account. A device holds its own signing and key-exchange keys; `device_id` is derived from the stable identity fields in its `DeviceCertificate`.

**Client**
An endpoint application acting for an account and device. Clients use public relays verified against the Registry and `RelayDescriptor` over HTTPS/WebSocket. Clients do not participate directly in the relay DHT.

**Public Relay**
A server implementing the client–relay protocol and joining the relay overlay network. Each relay uses a Neo account as its protocol identity; `relay_id` is the canonical text form of that account's script hash. The relay also has an independent, stable libp2p Peer identity.

### Calling and Routing Roles

**Calling Account and Calling Device**
The calling account initiates a client method, and the calling device is the device that account actually uses for this call. The relay confirms the account ID and device ID through a valid device session: HTTP requests use `X-Meshline-Session`, and WebSocket requests use the identity bound after `auth.device.verify` on that connection. When this protocol requires a request or object to be signed by the calling device, its device signature and accompanying `DeviceCertificate` MUST correspond to that device. An account session proves only the account key holder and cannot identify the calling device. For permissions, see [Session modes](discovery-and-sessions.md#session-modes); for establishment, validity, and revocation, see [Session authentication](../methods/authentication-and-sessions.md#session-authentication).

**Home Relay**
The account-state and message relay designated by an account through [`AccountRoute`](../../relay-dht/core-objects.md#accountroute). The home relay in the currently valid route is the current home relay. It stores the account's current `AccountDeviceState`, profile, and bounded-retention message timeline, and co-signs and publishes routes with the account.

**Source Relay**
The relay that receives a client request and initiates an inter-relay request. For cross-relay message delivery, the source relay MUST be the sender account's current home relay when it accepts `message.send`.

**Destination Relay**
The current home relay identified by `relay_id` in the target account's current route. It verifies inter-relay requests and performs queries or delivery.

## Calling and Routing Model

Account device-state and profile operations and `message.send` are submitted to the account's current home relay. Message timelines are read from the relay storing the corresponding records under [`message.timeline.sync`](../methods/messaging.md#messagetimelinesync). Queries for other accounts' profiles or devices may be submitted to the currently connected relay. When another relay must be accessed, the source relay resolves the target account's [`AccountRoute`](../../relay-dht/core-objects.md#accountroute), then connects directly to the target home relay. Retries of `message.send` follow the [idempotency rules](message-delivery.md#idempotent-message-retries). Query `message.delivery.status` directly on the relay that accepted that send request. Messages MUST NOT be forwarded hop by hop along a DHT lookup path.

Channel and group clients connect directly to the hosting relay designated by `relay_id` in the reference, without passing through the account route DHT or account message timelines.

The currently connected relay validates the local session and performs requesting-device authorization checks required by the specific method. The destination home relay MUST independently validate the route, request parameters, and business authorization; it additionally queries the requesting device's current state only when the method explicitly requires it.

## Trust Boundaries

Account private keys are used only for account-level objects such as co-signing `DeviceCertificate`, signing complete `AccountDeviceState` and account routes, and signing account-key challenges. A device first signs its own time-limited certificate, then the account confirms that device and validity period. Device keys sign profiles, contact grants, group requests, group application ciphertext, and other everyday objects. Account device state determines which certificates are currently valid; historical signatures are still verified using the complete certificates retained by objects or group events. Blockchain consensus state is the authorization root for the public relay membership directory. [`AccountRoute`](../../relay-dht/core-objects.md#accountroute) is authorized by the account and co-signed and published by the relay it designates.

DHT nodes, relays and their stored protocol state, source relays, and the transport network are not trust roots for user identity or message confidentiality. Noise protects the confidentiality and integrity of relay connections; end-to-end encrypted envelopes prevent any relay from reading message bodies.

A malicious relay can deny service and may violate hosting protocol rules, but cannot forge account or device signatures, read end-to-end encrypted bodies, or make other relays accept cross-relay requests that fail their independent validation rules.
