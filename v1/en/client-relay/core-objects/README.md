# Client–Relay Core Objects

[Client–relay protocol](../README.md)

This directory describes objects shared by clients and relays for discovery, authentication, account state and profile management, and message transport. `RelayDescriptor` binds relay identity, endpoints, and protocol capabilities. Account and device objects establish account identity, device permissions, and profile state. Message objects carry end-to-end encrypted content and define the cryptographic construction of recipient and sender key boxes.

| Core objects | Authoritative definition |
|---|---|
| `RelayDescriptor`, Peer ID, and relay endpoints | [Relay descriptor](relay-descriptor.md) |
| Account ID, device ID, `DeviceCertificate`, `AccountDeviceState`, `AccountProfile` | [Account profiles and device certificates](accounts-and-devices.md) |
| `MessageEnvelope`, encryption components, recipient and sender key boxes | [Message envelopes and end-to-end encryption](messages-and-content.md#message-envelopes-and-end-to-end-encryption) |
| `DirectMessage`, `DirectMessageReference`, `DeviceStateChanged` | [Plaintext message objects](messages-and-content.md#plaintext-message-objects) |
| `MessageBody`, attachment hash references | [Message body](messages-and-content.md#message-body) |
| `ContentReference` and `ContentEncryption` | [External content references](messages-and-content.md#external-content-references) |
