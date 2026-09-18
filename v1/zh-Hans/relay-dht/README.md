# 中继 DHT 协议

[Meshline Protocol 1.0](../README.md)

libp2p protocol ID：`/meshline/kad/1.0.0`

本协议定义公共中继覆盖网络的连接、身份认证和资源操作，供合格公共中继发布、复制和查询可完整验证的 DHT 资源。客户端不作为 DHT 节点。Protocol 1.0 注册的资源类型只有账户路由；消息、联系人、资料、聊天历史和私钥不得作为该资源写入 DHT。

DHT Peer 对应的公共中继必须具有 `status` 为 `active` 的 Registry 记录，并通过当前 `RelayDescriptor` 绑定 `relay_id`、Peer ID 和可拨号地址。远端 Peer、路由表、缓存和查询路径都不属于用户信任根；每个存储方和查询方必须独立验证 key、资源类型、签名、有效期和候选记录顺序。

## 协议内容

| 部分 | 内容 |
|---|---|
| [连接与身份认证](concepts/connection-and-authentication.md) | 覆盖网络的候选发现、Noise 扩展和中继资格验证 |
| [覆盖网络与节点维护](concepts/overlay-and-maintenance.md) | Peer 资格、入网与路由表维护、安全和节点状态持久化 |
| [账户路由发布与解析](concepts/account-route-lifecycle.md) | 共同签署、DHT 复制、迭代解析、缓存和重新发布 |
| [核心对象](core-objects.md) | 资源 key 派生、`AccountRoute` 的结构、签名、revision 与候选选择 |
| [消息格式](message-format.md) | protocol ID、消息分帧、protobuf 子集、公共字段和拒绝行为 |
| [DHT 操作](operations.md) | 节点查找、资源查询与写入的消息及处理规则 |

## 操作索引

- [`FIND_NODE`](operations.md#find_node)：查询更接近目标 key 的合格 Peer；
- [`GET_VALUE`](operations.md#get_value)：查询并验证资源记录；
- [`PUT_VALUE`](operations.md#put_value)：验证并持久化资源记录。

## 一致性要求

兼容实现须遵循[一致性测试边界](../test-vectors/README.md#一致性测试边界)，并覆盖：

- 连接与身份：按[连接认证](concepts/connection-and-authentication.md)验证已知中继出站、仅有 Peer ID 与地址的候选连接及陌生中继入站；后两者须仅凭握手描述符和 Registry 完成认证。按[覆盖网络维护规则](concepts/overlay-and-maintenance.md)验证资格失效、Peer ID 换绑与旧项移除。
- 消息与操作：按[消息格式](message-format.md)和[DHT 操作](operations.md)验证长度前缀、payload 上限、非法消息拒绝、多节点 PUT/GET 及 FIND_NODE 候选验证。
- 路由验证：按[核心对象](core-objects.md)验证网络与账户绑定、双方签名、资源 key、完整对象大小、时间边界、版本防回退及同版本冲突；无效高版本不得推进已知版本。
- 存储与恢复：按[路由生命周期](concepts/account-route-lifecycle.md)和[版本与冲突规则](core-objects.md#路由版本与冲突解决)验证重新发布、缓存、到期、清理、迁移、节点重启及网络分区恢复；版本下界和未解决冲突必须持续保留，最高版本路由到期或发生冲突后，须取得更高且无冲突的有效路由才能恢复解析。
