# Relay DHT protocol

[Meshline Protocol 1.0](../README.md)

libp2p protocol ID: `/meshline/kad/1.0.0`

This protocol defines connections, identity authentication, and resource operations in the public-relay overlay, allowing eligible public relays to publish, replicate, and query fully verifiable DHT resources. Clients do not act as DHT nodes. Account routes are the only resource type registered by Protocol 1.0. Messages, contacts, profiles, chat history, and private keys MUST NOT be written to the DHT as this resource.

A DHT peer's public relay MUST have a Registry record whose `status` is `active`, and its current `RelayDescriptor` must bind its `relay_id`, Peer ID, and dialable addresses. Remote peers, routing tables, caches, and lookup paths are not roots of user trust. Every storage node and querying node MUST independently verify the key, resource type, signatures, validity period, and ordering of candidate records.

## Protocol contents

| Part | Contents |
|---|---|
| [Connections and identity authentication](concepts/connection-and-authentication.md) | Overlay candidate discovery, Noise extension, and relay eligibility verification |
| [Overlay and node maintenance](concepts/overlay-and-maintenance.md) | Peer eligibility, joining, routing-table maintenance, security, and persistent node state |
| [Account route publication and resolution](concepts/account-route-lifecycle.md) | Joint signing, DHT replication, iterative resolution, caching, and republication |
| [Core objects](core-objects.md) | Resource-key derivation, `AccountRoute` structure, signatures, revision, and candidate selection |
| [Message format](message-format.md) | Protocol ID, message framing, protobuf subset, common fields, and rejection behavior |
| [DHT operations](operations.md) | Messages and processing rules for node lookup, resource retrieval, and storage |

## Operation index

- [`FIND_NODE`](operations.md#find_node): find eligible peers closer to a target key;
- [`GET_VALUE`](operations.md#get_value): retrieve and validate resource records;
- [`PUT_VALUE`](operations.md#put_value): validate and persist resource records.

## Conformance requirements

Compatible implementations must follow the [conformance testing boundaries](../test-vectors/README.md#conformance-testing-boundaries) and cover:

- Connections and identity: under [connection authentication](concepts/connection-and-authentication.md), verify outbound connections to known relays, candidate connections with only a Peer ID and address, and inbound connections from unfamiliar relays. The latter two must authenticate using only the handshake descriptor and Registry. Under the [overlay maintenance rules](concepts/overlay-and-maintenance.md), verify loss of eligibility, Peer ID rebinding, and removal of old entries.
- Messages and operations: under the [message format](message-format.md) and [DHT operations](operations.md), verify length prefixes, payload limits, rejection of invalid messages, multi-node PUT/GET, and FIND_NODE candidate validation.
- Route validation: under the [core objects](core-objects.md), verify network and account binding, both signatures, resource keys, complete-object size, time boundaries, version rollback prevention, and same-version conflicts. Invalid higher versions MUST NOT advance the known version.
- Storage and recovery: under the [route lifecycle](concepts/account-route-lifecycle.md) and [version and conflict rules](core-objects.md#route-version-and-conflict-resolution), verify republication, caching, expiry, cleanup, migration, node restart, and recovery from network partitions. Version lower bounds and unresolved conflicts MUST remain retained. After the highest-version route expires or conflicts, resolution requires a higher, conflict-free valid route.
