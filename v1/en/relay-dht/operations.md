# DHT operations

[Relay DHT protocol](README.md) · [Message format](message-format.md)

Eligible public relays MUST support `FIND_NODE`, `GET_VALUE`, and `PUT_VALUE`. Connections, message framing, common fields, and rejection behavior all follow the [message format](message-format.md). Routing-table refresh follows the rules for [joining the DHT and maintaining the routing table](concepts/overlay-and-maintenance.md#joining-the-dht-and-maintaining-the-routing-table).

`ADD_PROVIDER`, `GET_PROVIDERS`, and IPNS records are outside this protocol. A message type present in the protobuf schema but not defined in this document acquires no Protocol 1.0 resource semantics.

## `FIND_NODE`

`FIND_NODE` finds eligible peers closer to a target key by Kademlia XOR distance.

### Messages

The initiating message has `Message.type` set to `FIND_NODE`, carries the nonempty raw lookup input in `Message.key`, and carries no `record`.

The reply has the same `Message.type` and `Message.key` as the initiating message, supplies candidate peers in `closerPeers`, and carries no `record`.

### Receiving node processing

The receiving node selects candidate peers closer to the target key from its local Kademlia routing table.

### Initiating node processing

The initiating node MUST process returned candidates under [candidate discovery and connection authentication](concepts/connection-and-authentication.md#candidate-discovery).

## `GET_VALUE`

`GET_VALUE` retrieves the resource record corresponding to a 32-byte DHT key.

### Messages

The initiating message has `Message.type` set to `GET_VALUE`, carries the DHT key to query in `Message.key`, and carries no `record`.

The reply has the same `Message.type` and `Message.key` as the initiating message and MAY contain both one `record` and `closerPeers`. The receiving node omits `record` when it has no local record to return.

### Receiving node processing

The receiving node may return only a local record with a matching key that has not expired and can be validated under its resource-type rules. It omits `record` when no available account route satisfies the locally persisted highest-version requirement, or when a same-version conflict has not yet been superseded by a higher version.

### Initiating node processing

The initiating node MUST process candidates in `closerPeers` under [candidate discovery and connection authentication](concepts/connection-and-authentication.md#candidate-discovery).

The initiating node MUST continue the complete Kademlia lookup. It MUST NOT infer that a resource does not exist merely because a single reply omits `record`. It MUST validate every collected candidate record and select the final result according to the resource-type rules. Iterative lookup, candidate selection, and caching for account routes are defined in [account route publication and resolution](concepts/account-route-lifecycle.md#resolution-and-candidate-selection).

## `PUT_VALUE`

`PUT_VALUE` asks the receiving node to validate and persist a DHT resource record.

### Messages

The initiating message has `Message.type` set to `PUT_VALUE` and carries both `Message.key` and `Message.record`. `Message.record.key` MUST equal `Message.key` byte for byte.

The reply has the same `Message.type` and `Message.key` as the initiating message. Only after accepting and persisting the record does the receiving node include that `record` unchanged in its reply. Omitting `record` means that the node did not accept the write.

### Receiving node processing

The receiving node MUST determine the supported resource type and canonical resource ID from `Message.record.value`, derive the key again, and perform all resource-type validation. It MUST NOT accept an account route below its locally persisted highest version and omits `record` in its reply. It may echo `record` unchanged only after validation succeeds and both the record and its corresponding [route-version information](core-objects.md#route-version-and-conflict-resolution) have been persisted.

### Initiating node processing

The initiating node may treat a peer as having accepted the write only when the reply carries the exact original `record`. A reply omitting `record`, or a stream terminating before a reply is received, is not a replica acknowledgement from that peer. Account route publication, replication, and republication are defined in [account route publication and resolution](concepts/account-route-lifecycle.md#publication-and-replication).
