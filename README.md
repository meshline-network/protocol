# Meshline Protocol

Meshline is a decentralized messaging and social protocol built around self-sovereign identity.

This repository contains the protocol specification and shared interoperability test vectors for developers building clients, public relays, and SDKs. It defines how independent implementations discover one another, authenticate devices, route messages, and exchange data across the network.

**Protocol 1.0 — Specification draft**

## Core capabilities

- **Self-sovereign identity and device authorization.** Control your account through keys you hold, with separate device keys and explicit authorization for everyday communication.
- **Public relay discovery and verification.** Discover relay membership through the on-chain Registry and verify relay identities, endpoints, and declared capabilities.
- **Distributed routing and cross-relay delivery.** Resolve account routes through the relay DHT, then deliver messages directly between the sender's and recipient's home relays.
- **End-to-end encrypted direct messaging.** Encrypt message content on clients while relays handle ciphertext storage, synchronization, and delivery.
- **Optional channel and group hosting.** Support public channels and hosted groups through optional client–relay protocol modules.

## Documentation

Start with the [English specification](v1/en/README.md), browse the [online reader](https://meshline.org/protocol/v1/index.html), or read the [Simplified Chinese specification](v1/zh-Hans/README.md).

| Section | What it covers |
|---|---|
| [General conventions](v1/en/general.md) | Scope, terminology, network context, data representations, and cryptographic conventions |
| [Relay Registry](v1/en/registry/README.md) | Public-relay membership, on-chain records, and the interoperable contract ABI |
| [Client–relay](v1/en/client-relay/README.md) | Device sessions, account state, contacts, messaging, channels, and groups |
| [Relay DHT](v1/en/relay-dht/README.md) | Relay discovery within the overlay and distributed account-route publication and lookup |
| [Relay RPC](v1/en/relay-rpc/README.md) | Direct account queries and message delivery between relays |
| [Test vectors](v1/en/test-vectors/README.md) | Fixed inputs, protocol bytes, and expected results for interoperability checks |

For a first implementation, read the general conventions before the relevant protocol sections. Use the test vectors to check encoding and cryptographic operations against the specification.

## Contributing

Issues and pull requests are welcome for specification clarifications, interoperability problems, and improvement proposals. Describe the affected protocol section, the behavior you observed or propose, and a reproducible example where possible.

To validate a local checkout, install Node.js 22.13.0 or later and run:

```sh
npm ci
npm test
```

See the [maintenance guide](v1/maintenance/README.md) for repository language conventions, translation reviews, validation details, and downstream synchronization.
