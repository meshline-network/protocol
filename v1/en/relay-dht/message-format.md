# DHT message format

[Relay DHT protocol](README.md) · [DHT operations](operations.md)

## Connections and message framing

DHT operations run between eligible public relays already verified under [relay connections and identity authentication](concepts/connection-and-authentication.md). Each stream uses libp2p protocol `/meshline/kad/1.0.0`; messages are encoded as an unsigned-varint length prefix followed by protobuf bytes, with a maximum message size of 1 MiB. The outer prefix follows the common [message length-prefix encoding](../general.md#message-length-prefix-encoding) rules.

Protocol 1.0 does not transmit resources that cannot fit in one message. Oversized content MUST NOT be written to a single `Record`. Peer eligibility, connection identity, and routing-table maintenance are defined in [overlay and node maintenance](concepts/overlay-and-maintenance.md#overlay).

## Protobuf messages

DHT streams use the following subset of the libp2p Kademlia protobuf schema. `Message` is the outer frame for a DHT query or write and its reply; `Record` carries the resource value for a DHT key; the nested `Peer` represents a candidate relay peer, closer to the target key, supplied in the reply direction.

```protobuf
message Record {
  optional bytes key = 1;
  optional bytes value = 2;
}

message Message {
  enum MessageType {
    PUT_VALUE = 0;
    GET_VALUE = 1;
    ADD_PROVIDER = 2;
    GET_PROVIDERS = 3;
    FIND_NODE = 4;
    PING = 5;
  }
  enum ConnectionType {
    NOT_CONNECTED = 0;
    CONNECTED = 1;
    CAN_CONNECT = 2;
    CANNOT_CONNECT = 3;
  }
  message Peer {
    optional bytes id = 1;
    repeated bytes addrs = 2;
    optional ConnectionType connection = 3;
  }
  optional MessageType type = 1;
  optional bytes key = 2;
  optional Record record = 3;
  repeated Peer closerPeers = 8;
}
```

## Field semantics

- `Message.key` carries the operation's raw target input; `Message.record.key` is the raw 32-byte resource key obtained from the [resource-key derivation rules](core-objects.md#resource-key-derivation-rules);
- `Message.record.value` carries the resource content; its encoding and size are specified by the [account route resource rules](core-objects.md#dht-resource-identification);
- `Peer.id` is the raw multihash bytes of the candidate Peer ID; each `Peer.addrs` entry is the binary encoding of a multiaddr. Candidate processing follows [connections and identity authentication](concepts/connection-and-authentication.md).

Presence requirements for `type`, `key`, `record`, and `closerPeers` in each operation are defined in [DHT operations](operations.md).

## Extensions and compatibility

- `providerPeers`, `clusterLevelRaw`, and unused message types MUST NOT affect resource-query results;
- Unknown protobuf fields are ignored under protobuf compatibility rules.

## Message rejection and failure handling

Receivers MUST reject messages whose key length violates the relevant operation's requirements. If a message carries `record`, it MUST also be rejected when `Message.record.key` differs from `Message.key`, or `Message.record.value` violates the rules for its resource type.

Kademlia messages have no protocol-error response field. Invalid length prefixes terminate the stream under [connections and message framing](#connections-and-message-framing). When rejecting a message because of other framing errors, an oversized message, rate limiting, an invalid key, an invalid record, or an unsupported resource type, the receiver MUST close or reset the corresponding stream.

If the stream terminates before a valid reply is received, the initiator MUST treat the operation as a temporary failure and apply its local backoff policy. It MUST NOT retry immediately in a loop.
