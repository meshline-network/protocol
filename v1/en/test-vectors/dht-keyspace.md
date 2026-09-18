# DHT Test Vector Execution Guide

[Normative test vectors](README.md) · [Common execution rules](README.md#common-execution-rules)

## Coverage

File: [`dht-keyspace-v1.json`](../../test-vectors/dht-keyspace-v1.json). Sections: `resource_key` and `keyspace`.

## Fixed Inputs and References

`keyspace.peers` provides base58btc text, raw multihash bytes, and expected keyspace positions for Peer IDs from official libp2p examples.

The `key_hex` in `keyspace.cases` is the wire `Message.key`; `key_source.peer` identifies a Peer ID in `keyspace.peers`. For resource key cases, `key_source.value_ref` points to `/resource_key/expected/expected_key_hex` in the same file and expands to that case's `key_source.value`.

## Execution Steps and Assertions

### Resource Key Derivation

`resource_key` provides network-bound derivation inputs and expected values for an account route resource identifier. First independently compare its Canonical JSON, UTF-8, SHA-256, and raw key.

The protocol value of a DHT key is the raw 32 bytes decoded from `expected_key_hex`; `expected_key_base64url` is supplied only for convenient comparison in logs and test frameworks.

### Keyspace and FIND_NODE

Check the key length, SHA-256 position, and each candidate's XOR distance byte for byte. `find_node_request_hex` is a protobuf request containing only `type = FIND_NODE` and the raw `key`; `framed_request_hex` additionally contains an unsigned-varint length prefix. Responses MUST echo the same raw key.

The distance to the local Peer itself MUST be zero. Although a resource key has already undergone resource identifier derivation, distance calculation still MUST apply the keyspace mapping once. Do not skip that mapping or substitute the mapped result for the wire key.

These vectors do not cover connection authentication, routing tables, or actual network queries.
