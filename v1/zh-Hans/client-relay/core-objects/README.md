# 客户端—中继核心对象

[客户端—中继协议](../README.md)

本目录介绍客户端和中继在发现、身份验证、账户状态与资料管理以及消息传输中共同使用的对象：`RelayDescriptor` 绑定中继身份、端点和协议能力；账户与设备对象建立账户身份、设备权限和资料状态；消息对象承载端到端加密内容，并定义收件方和发送方密钥盒的加密构造。

| 核心对象 | 权威定义 |
|---|---|
| `RelayDescriptor`、Peer ID 与中继 endpoint | [中继描述符](relay-descriptor.md) |
| 账户 ID、设备 ID、`DeviceCertificate`、`AccountDeviceState`、`AccountProfile` | [账户资料与设备证书](accounts-and-devices.md) |
| `MessageEnvelope`、加密组成、收件方与发送方密钥盒 | [消息信封与端到端加密](messages-and-content.md#消息信封与端到端加密) |
| `DirectMessage`、`DirectMessageReference`、`DeviceStateChanged` | [消息明文对象](messages-and-content.md#消息明文对象) |
| `MessageBody`、附件哈希引用 | [消息正文](messages-and-content.md#消息正文) |
| `ContentReference` 与 `ContentEncryption` | [外部内容引用](messages-and-content.md#外部内容引用) |
