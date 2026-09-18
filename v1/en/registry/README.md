# Relay Registry

[Meshline Protocol 1.0](../README.md)

The Relay Registry is the on-chain directory through which the Meshline network publishes public-relay membership records. Clients and relays obtain a candidate relay's `relay_id`, initial HTTPS endpoint, and current membership status from this directory. The service identity is bound by a [`RelayDescriptor`](../client-relay/core-objects/relay-descriptor.md#relaydescriptor). After obtaining it through the HTTPS discovery interface or the [relay Noise handshake](../relay-dht/concepts/connection-and-authentication.md), the caller verifies it against the current Registry record.

The current Neo N3 relay registry contract is named `MeshlineRegistry`. The remainder of this document calls it the Registry.

This protocol defines the Registry data structures, public ABI, and observable behavior required for Meshline Protocol 1.0 interoperability. A concrete contract may additionally expose implementation interfaces for deployment lifecycle, contract verification, upgrades, governance, payment callbacks, or events. Unless listed in this protocol, those interfaces are not part of the ABI that other compatible Registry implementations MUST provide. The complete ABI of the repository's reference contract is documented in [Meshline.Contracts](https://meshline.org/en/resources#reference-contract).

Account routing is provided by the signed documents and DHT defined in [AccountRoute and the relay resource DHT](../relay-dht/core-objects.md#accountroute); the Registry handles only the public-relay membership directory.

## Participants and trust boundaries

Registry methods invoke the Neo N3 contract ABI at the Registry contract address specified by the trusted [network context](../general.md#network-context).

Public-relay operators invoke registration and record-maintenance methods using the relay's Neo account. Clients and other relays only read public Registry state. The Registry's on-chain consensus state is authoritative for relay membership. The endpoint's protocol identity, descriptor validity period, and service capabilities must additionally be confirmed under the [`RelayDescriptor` verification rules](../client-relay/core-objects/relay-descriptor.md#relay-descriptor-validation-rules).

The Registry does not prove that a relay is currently reachable and does not authorize user accounts, messages, or account routes. The way governance changes fees or suspends membership is outside the public protocol ABI; implementations depend only on the observable `RelayEntry` state produced by those actions.

## Protocol contents

| Part | Contents |
|---|---|
| [Core objects](core-objects.md) | Authoritative structures and state semantics for `relay_id` and `RelayEntry` |
| [Methods](methods.md) | Public queries, relay registration, and record maintenance |

## Conformance requirements

Compatible implementations MUST preserve the public ABI, parameter order, return structures, and observable state semantics listed in this protocol. Callers MUST NOT depend on convenience query interfaces not listed here for interoperability.
