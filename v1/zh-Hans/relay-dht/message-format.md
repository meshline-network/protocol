# DHT 消息格式

[中继 DHT 协议](README.md) · [DHT 操作](operations.md)

## 连接与消息分帧

DHT operation 运行在已经按[中继连接与身份认证](concepts/connection-and-authentication.md)完成验证的合格公共中继之间。每个 stream 使用 libp2p protocol `/meshline/kad/1.0.0`，消息以 unsigned varint 长度前缀加 protobuf bytes 编码，单条消息最大 1 MiB。外层长度前缀遵循统一的[消息长度前缀编码](../general.md#消息长度前缀编码)规则。

Protocol 1.0 不传输无法容纳在单条消息中的资源，不得把超限内容写入单个 `Record`。Peer 资格、连接身份和路由表维护见[覆盖网络与节点维护](concepts/overlay-and-maintenance.md#覆盖网络)。

## Protobuf 消息

DHT stream 使用 libp2p Kademlia protobuf schema 的以下子集。`Message` 是一次 DHT 查询或写入及其返回消息的外层帧；`Record` 承载一个 DHT key 对应的资源 value；嵌套 `Peer` 是返回方向提供的、更接近目标 key 的候选中继 Peer。

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

## 字段语义

- `Message.key` 携带本次操作的原始目标输入；`Message.record.key` 是按[资源键派生规则](core-objects.md#资源键派生规则)得到的原始 32-byte 资源 key；
- `Message.record.value` 承载资源内容，其编码和大小见[账户路由资源规则](core-objects.md#dht-资源标识)；
- `Peer.id` 是候选 Peer ID 的原始 multihash bytes；`Peer.addrs` 的每一项是一个 multiaddr 的二进制编码。候选处理遵循[连接与身份认证](concepts/connection-and-authentication.md)；

各 operation 对 `type`、`key`、`record` 和 `closerPeers` 的出现规则见 [DHT 操作](operations.md)。

## 扩展与兼容规则

- `providerPeers`、`clusterLevelRaw` 和未使用消息类型不得影响资源查询结果；
- 未知 protobuf 字段按 protobuf 兼容规则忽略。

## 消息拒绝与失败处理

接收方必须拒绝 key 长度不符合相应操作要求的消息。消息携带 `record` 时，若 `Message.record.key` 与 `Message.key` 不一致，或 `Message.record.value` 不符合相应资源类型规则，也必须拒绝。

Kademlia 消息没有协议错误响应字段。非法长度前缀按[连接与消息分帧](#连接与消息分帧)规则终止 stream。因其他消息分帧错误、消息超过大小上限、限流、无效 key、无效 record 或不支持的资源类型拒绝消息时，必须关闭或 reset 对应 stream。

在取得有效返回消息前 stream 终止时，发起方必须将本次操作视为临时失败，并按本地退避策略处理，不得立即循环重试。
