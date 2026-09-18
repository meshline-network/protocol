# 中继发现与会话

[客户端—中继协议](../README.md) · [RelayDescriptor](../core-objects/relay-descriptor.md)

## 中继发现

客户端或中继通过 Registry 发现公共中继时必须：

1. 从可信配置取得[网络上下文](../../general.md#网络上下文)；
2. 按[Registry 查询](../../registry/methods.md#getrelay)通过 `listRelays()` 获取候选记录，或通过 `getRelay` 查询已知 `relay_id` 的记录；仅将 `status` 为 `active` 的记录作为候选；
3. 确认 `endpoint` 满足 [Registry 入口约束](../../registry/core-objects.md#relayentry)，从 `<endpoint>/relay/descriptor` 获取 `RelayDescriptor`；
4. 确认描述符的 `relay_id` 与所选 Registry 记录一致，再按 `RelayDescriptor` 的[验证规则](../core-objects/relay-descriptor.md#中继描述符验证规则)验证描述符；
5. 只向验证成功且确实提供所需服务或功能的中继发起对应请求；使用可选能力时，还必须确认 `RelayDescriptor` 的 `capabilities` 包含相应能力声明。

通过上述 Registry 流程获取 `RelayDescriptor` 时，必须使用 Registry 记录中的发现入口。`RelayDescriptor` 验证成功后，业务连接使用其 `endpoints` 中的候选地址。没有仍在有效期内且已经验证的缓存 `RelayDescriptor` 时，发现入口无法连接即表示本次 Registry 发现失败。

中继从 DHT 候选地址建立连接或接受陌生中继入站连接时，按[中继连接与身份认证](../../relay-dht/concepts/connection-and-authentication.md#候选发现)通过 Noise 握手取得对端的完整 `RelayDescriptor`。验证方按其中的 `relay_id` 查询 Registry 并验证描述符及连接身份；候选地址本身不授予业务访问权。

## 会话模式

会话是中继认证成功后建立的身份与授权状态；会话令牌（`token`）是中继签发、供客户端使用该会话的凭据。

本协议定义两种固定会话模式。模式决定认证所证明的身份以及该会话可以调用的方法，不提供由客户端任意组合的用途或 scope。

| 会话模式 | 认证身份 | 权限 |
|---|---|---|
| `device` | 账户中的当前有效设备 | 可以调用要求或允许设备会话的方法，包括发布本账户设备状态和读取设备状态 |
| `account` | 账户密钥持有者 | 可以调用 `device.state.publish`、`account.route.publish`，以及通过 `device.state.resolve` 读取本账户设备状态；不能通过 `device.state.resolve` 查询其他账户，不能满足其他方法的会话要求，也不能建立订阅或接收服务端通知 |

账户会话用于设备尚未建立、全部设备均不可用或需要恢复账户设备状态的场景。它不对应某台设备，也不代替设备会话参与资料、联系人、消息、频道或群组操作。

## 会话信任边界

设备会话只证明中继在建立会话时确认的账户和设备身份；账户会话只证明账户密钥持有者，不能确认调用设备。两种会话均只对建立它的[中继 origin](../methods/authentication-and-sessions.md#中继-origin-计算规则)有效。切换 HTTPS origin 或新建 WSS 连接后，调用需要会话的方法前必须按该方法允许的模式重新认证。

会话有效期、设备证书续期及设备状态变化对既有会话的影响，遵循 [`SessionCredentials`](../methods/authentication-and-sessions.md#sessioncredentials) 和[会话有效性与连接绑定](../methods/authentication-and-sessions.md#会话有效性与连接绑定)的规则。

WSS 会话仍有效时，客户端可以按[会话续期](../methods/authentication-and-sessions.md#websocket-会话续期)规则在原连接上重新认证，更新会话期限并保留仍有效的订阅。
