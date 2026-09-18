# DHT 测试向量执行说明

[规范测试向量](README.md) · [通用执行规则](README.md#通用执行规则)

## 覆盖范围

文件：[`dht-keyspace-v1.json`](../../test-vectors/dht-keyspace-v1.json)。章节为 `resource_key` 和 `keyspace`。

## 固定输入与引用

`keyspace.peers` 提供 libp2p 官方示例 Peer ID 的 base58btc 文本、原始 multihash bytes 和预期 keyspace 位置。

`keyspace.cases` 的 `key_hex` 是线上 `Message.key`，`key_source.peer` 指明 `keyspace.peers` 中的 Peer ID；资源 key 项的 `key_source.value_ref` 指向同文件 `/resource_key/expected/expected_key_hex`，展开后为该项 `key_source.value`。

## 执行步骤与断言

### 资源 key 派生

`resource_key` 提供账户路由资源标识的网络绑定派生输入和预期值；先独立比对其 Canonical JSON、UTF-8、SHA-256 和原始 key。

DHT key 的协议值是 `expected_key_hex` 解码后的原始 32 bytes；`expected_key_base64url` 只用于便于日志和测试框架比较。

### Keyspace 与 FIND_NODE

逐 byte 核对 key 长度、SHA-256 位置和各候选的 XOR 距离。`find_node_request_hex` 是只含 `type = FIND_NODE` 和原始 `key` 的 protobuf 请求，`framed_request_hex` 另包含 unsigned-varint 长度前缀；响应必须回显同一原始 key。

自身 Peer 的距离必须为零。资源 key 已经过资源标识派生，计算距离时仍须执行一次 keyspace 映射；不得跳过该映射，也不得把映射后的结果代替线上 key。

这些向量不包含连接认证、路由表或实际网络查询。
