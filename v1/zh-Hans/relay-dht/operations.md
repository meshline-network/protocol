# DHT 操作

[中继 DHT 协议](README.md) · [消息格式](message-format.md)

合格公共中继必须支持 `FIND_NODE`、`GET_VALUE` 和 `PUT_VALUE`。连接、消息分帧、公共字段和拒绝行为统一遵循[消息格式](message-format.md)。路由表刷新遵循[DHT 入网与路由表维护](concepts/overlay-and-maintenance.md#dht-入网与路由表维护)的规则。

`ADD_PROVIDER`、`GET_PROVIDERS` 和 IPNS record 不属于本协议。protobuf schema 中存在但未在本文件定义的 message type 不获得 Protocol 1.0 资源语义。

## `FIND_NODE`

`FIND_NODE` 按 Kademlia XOR 距离查找更接近目标 key 的合格 Peer。

### 消息

发起消息的 `Message.type` 为 `FIND_NODE`，`Message.key` 携带非空的原始查找输入，并且不携带 `record`。

返回消息的 `Message.type` 和 `Message.key` 与发起消息一致，通过 `closerPeers` 提供候选 Peer，并且不携带 `record`。

### 接收节点处理

接收节点按本地 Kademlia 路由表选择更接近目标 key 的候选 Peer。

### 发起节点处理

发起节点必须按[候选发现与连接认证](concepts/connection-and-authentication.md#候选发现)处理返回的候选 Peer。

## `GET_VALUE`

`GET_VALUE` 查询一个 32-byte DHT key 对应的资源记录。

### 消息

发起消息的 `Message.type` 为 `GET_VALUE`，`Message.key` 是要查询的 DHT key，并且不携带 `record`。

返回消息的 `Message.type` 和 `Message.key` 与发起消息一致，可以同时包含一个 `record` 和 `closerPeers`；接收节点没有可返回的本地记录时省略 `record`。

### 接收节点处理

接收节点只能返回 key 一致、尚未过期并能按相应资源类型规则验证的本地记录。没有满足本地持久化最高版本要求的可用账户路由，或者存在尚未被更高版本替换的同版本冲突时，省略 `record`。

### 发起节点处理

发起节点必须按[候选发现与连接认证](concepts/connection-and-authentication.md#候选发现)处理 `closerPeers` 中的候选 Peer。

发起节点必须继续执行完整 Kademlia 查询，不得因为单个返回消息省略 `record` 就认定资源不存在。它必须验证收集到的每个候选记录，并按资源类型规则选择最终结果。账户路由的迭代查询、候选选择和缓存规则见[账户路由发布与解析](concepts/account-route-lifecycle.md#解析与候选选择)。

## `PUT_VALUE`

`PUT_VALUE` 要求接收节点验证并持久化一个 DHT 资源记录。

### 消息

发起消息的 `Message.type` 为 `PUT_VALUE`，并同时携带 `Message.key` 和 `Message.record`；`Message.record.key` 必须与 `Message.key` byte-for-byte 相同。

返回消息的 `Message.type` 和 `Message.key` 与发起消息一致。接收节点只有在接受并持久化记录后，才在返回消息中原样携带该 `record`；省略 `record` 表示该节点没有接受写入。

### 接收节点处理

接收节点必须从 `Message.record.value` 确定受支持的资源类型和规范资源 ID，重新派生 key，并执行资源类型规则的全部验证。低于本地持久化最高版本的账户路由不得接受，返回消息省略 `record`。只有验证通过且记录及其相应的[路由版本信息](core-objects.md#路由版本与冲突解决)已经持久化，才能原样返回 `record`。

### 发起节点处理

发起节点只能把返回消息中原样携带的 `record` 视为该 Peer 已接受本次写入。返回消息省略 `record` 或 stream 在取得返回消息前终止时，该 Peer 不构成副本确认。账户路由的发布、复制与重新发布流程见[账户路由发布与解析](concepts/account-route-lifecycle.md#发布与复制)。
