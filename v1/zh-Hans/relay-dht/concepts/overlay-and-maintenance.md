# 覆盖网络与节点维护

[中继 DHT 协议](../README.md) · [AccountRoute](../core-objects.md#accountroute)

## 覆盖网络

DHT Peer 由 Registry 成员资格状态为 `active` 并持有有效 `RelayDescriptor` 的公共中继运行；连接通过[中继连接与身份认证](connection-and-authentication.md)验证握手中的完整描述符及其与 Peer ID 的绑定。客户端不作为 DHT 节点。

合格中继组成独立的 libp2p Kademlia DHT：

- transport：TCP；
- secure channel：[Noise](connection-and-authentication.md#安全协议与握手格式)；
- stream multiplexer：Yamux；
- Kademlia protocol ID：`/meshline/kad/1.0.0`；
- key distance：按 libp2p Kademlia 规范，对原始查找输入和 Peer ID bytes 分别执行 SHA-256，再对两个 32-byte 结果计算 XOR 距离。

Peer ID 和 multiaddr 必须符合对应 libp2p 规范。Kademlia 行为遵循 [libp2p Kademlia DHT 规范](https://github.com/libp2p/specs/blob/master/kad-dht/README.md)，本协议明确收紧或替换的部分除外。

## DHT 入网与路由表维护

### 公共中继注册与入网流程

```mermaid
flowchart LR
    A["运营者准备 relay_id 与 Peer 身份"] --> B["部署客户端—中继接口和 RelayDescriptor"]
    B --> C["调用 MeshlineRegistry.registerRelay"]
    C --> D["确认中继当前可用"]
    D --> E["取得候选 Peer"]
    E --> F["加入 DHT 并开放中继间协议"]
```

中继只有在公开服务可用，且 `RelayDescriptor` 通过[中继描述符验证](../../client-relay/core-objects/relay-descriptor.md#中继描述符验证规则)时，才可加入覆盖网络。

### 启动入网

中继启动时必须：

1. 从 Registry 确认对应中继的 `status` 为 `active`；
2. 从 Registry 或本地保存的 Peer 信息取得初始候选，按[候选发现与连接认证](connection-and-authentication.md#候选发现)建立连接并完成身份认证；
3. 把通过验证的候选加入合格 Peer 集合；
4. 通过 `/meshline/kad/1.0.0` 建立路由表。

### 运行期维护

运行期间，中继必须刷新 Registry 状态，并通过相应中继的 HTTPS 发现入口刷新 `RelayDescriptor`。中继还必须维护 Kademlia buckets，使路由表只使用当前合格的 Peer。

后续通过 DHT 得到的候选 Peer 同样必须完成连接身份验证，才能加入合格 Peer 集合和路由表。

中继发现远端成员资格已由运营者停用、已被 Registry 治理方暂停、`RelayDescriptor` 已失效或 Peer ID 不匹配时，必须停止向该 Peer 发起新查询和新投递，并从合格 Peer 集合和路由表中移除。

刷新后同一 `relay_id` 的有效 `RelayDescriptor` 绑定了新的 Peer ID 时，验证方必须移除旧 Peer，再加入新 Peer，不得同时保留两者。

同一刷新结果中出现重复 `relay_id`、一个 `relay_id` 对应多个 Peer ID，或者一个 Peer ID 对应多个 `relay_id` 时，不得把冲突记录分别加入路由表。

## 节点状态持久化

DHT 节点应在重启后保留自身 Peer 私钥和 Peer ID。更换 Peer 身份时，必须更新 `RelayDescriptor` 并按[启动入网](#启动入网)规则重新入网。

DHT 节点重启后必须保留未过期的 DHT values 及其本地到期时间。路由表可以重建。过期值不得作为查询结果返回，也不得用于路由或重新发布。

账户路由的版本信息必须按[路由版本与冲突解决](../core-objects.md#路由版本与冲突解决)规则持久化。当前归属中继负责的账户路由副本及重启后恢复重新发布的要求见[账户路由发布与解析](account-route-lifecycle.md#重新发布与持久化)。

## Peer 与资源安全

- 合格 Peer 集合和路由表必须同时保持 `relay_id` 与 Peer ID 的一一绑定；多个候选地址不得被计为多个 Peer；
- 启动连接时，应优先选择运营来源、IP 网段和域名来源不同的 Peer；
- Registry 成员资格验证、连接级速率限制和 Peer 来源多样性共同约束批量恶意 Peer。

中继可以断开或临时拒绝持续发送无效请求的 Peer。

实现可以使用多个独立查询路径降低单个恶意 Peer 隐藏路由的能力；路径数量和查询并发属于本地策略。本协议不保证在合格中继多数串通、目标中继拒绝服务或网络完全隔离时仍然可用。
