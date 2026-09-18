# 中继描述符核心对象

[客户端—中继协议](../README.md) · [核心对象索引](README.md)

## `RelayDescriptor`

`RelayDescriptor` 是公共中继的可验证服务身份声明，通过客户端—中继接口发布，并在[中继 Noise 握手](../../relay-dht/concepts/connection-and-authentication.md#安全协议与握手格式)中交换。它把链上 `relay_id`、对应的 Neo 公钥、客户端端点、libp2p Peer ID、协议能力和有效期绑定为一个签名对象。客户端用它确认业务端点与中继身份的绑定；其他中继直接验证握手提供的描述符，并结合 Registry 当前记录确认其与连接 Peer ID 的绑定。中继网络资格要求 Registry 记录的 `status` 为 `active`，并且 RelayDescriptor 有效。

Peer ID 由中继的 libp2p Peer 公钥按 libp2p 规范派生，用于标识安全连接身份；`relay_id` 标识中继的 Neo 账户身份。

```json
{
  "$type": "meshline.relay.descriptor",
  "relay_id": "0x1234567890abcdef1234567890abcdef12345678",
  "public_key": "base64url...",
  "endpoints": [
    "https://relay.example.com/meshline/v1",
    "wss://relay.example.com/meshline/v1",
    "/dns4/relay.example.com/tcp/4201/p2p/12D3KooW..."
  ],
  "capabilities": [
    "channel.host.v1"
  ],
  "expires_at": 1730086400,
  "relay_signature": "base64url..."
}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.relay.descriptor` |
| `relay_id` | string | 是 | Registry 记录中的[中继 ID](../../registry/core-objects.md#中继-id) |
| `public_key` | string | 是 | 33-byte SEC1 compressed `secp256r1` 公钥，无 padding base64url；必须派生出 `relay_id` |
| `endpoints` | array&lt;string&gt; | 是 | 非空的端点地址集合；格式见[中继端点地址](#中继端点地址) |
| `capabilities` | array&lt;string&gt; | 否 | 中继发布的能力声明；没有可选能力声明时为空或省略；最多 64 项，每项必须是非空且不超过 128 UTF-8 bytes 的字符串；按大小写敏感的完整字符串比较且不得重复；数组顺序不承载语义，未知名称必须忽略 |
| `expires_at` | integer | 是 | 到期时间；当前时间达到或超过该值后，描述符不再有效 |
| `relay_signature` | string | 是 | `relay_id` 对应的 Neo N3 中继账户按[账户签名](../../general.md#账户签名)生成的 64-byte 签名，无 padding base64url |

签名时排除根 `relay_signature` 字段，并按[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)规则构造签名输入。

### 服务要求与能力声明

公共中继必须完整提供中继发现和身份验证、HTTPS 客户端基础 API、设备与资料状态、账户路由、DHT 查询、中继间转发、消息发送、有限期账户消息时间线和 HTTP 同步。

本规范为频道和群组托管服务定义以下能力声明：

| 能力标识 | 对应服务与实现要求 |
|---|---|
| `channel.host.v1` | 中继提供频道托管服务时必须包含的能力声明；声明后必须完整提供[频道方法索引](../channels/README.md#方法索引)中具有 HTTP 形式的接口，并按 [`auth.device.verify`](../methods/authentication-and-sessions.md#authdeviceverify) 的规则核验直接连接频道中继的远程设备；存在 WSS endpoint 时还必须提供频道订阅和[频道通知](../channels/README.md#通知索引) |
| `group.host.v1` | 中继提供群组托管服务时必须包含的能力声明；声明后必须完整提供[群组方法索引](../groups/README.md#方法索引)中具有 HTTP 形式的接口，并按 [`auth.device.verify`](../methods/authentication-and-sessions.md#authdeviceverify) 的规则核验直接连接群组中继的远程设备；存在 WSS endpoint 时还必须提供群组订阅和[群组通知](../groups/README.md#通知索引) |

## 中继端点地址

### 地址格式与校验

本协议定义以下可拨号地址格式，其格式同时确定传输方式：

| 地址格式 | 用途 |
|---|---|
| `https://...` | 公共客户端 HTTP API 基地址 |
| `wss://...` | 公共中继提供的客户端 WebSocket 完整连接地址 |
| 包含 `/tcp/` 和 `/p2p/<peer-id>` 的 libp2p multiaddr | 中继间连接 |

公共中继必须提供至少一个 HTTPS 地址和一个 libp2p TCP multiaddr。存在 WSS 地址表示中继完整提供[WebSocket JSON-RPC](../methods/conventions.md#websocket-json-rpc)的客户端 WebSocket 传输与通知机制；没有 WSS 地址表示该机制不可用。

每个 HTTPS 候选地址都必须满足 [Registry 入口](../../registry/core-objects.md#relayentry)的全部格式约束。WSS 候选使用 `wss` scheme；其余格式约束与 HTTPS 候选相同。两者都必须是具有有效主机的绝对 URL；空 query 或 fragment 也不允许。HTTP 请求地址的构造和 WSS 连接方式见[方法与请求映射](../methods/conventions.md#方法与请求映射)。

对本规范已定义的 HTTPS、WSS 和 libp2p TCP 地址，任一候选地址格式无效时，整个描述符无效；不得把这些地址的格式错误作为未知传输格式忽略。验证方不得通过补齐路径、删除禁用部分或改写地址后接受描述符；签名验证使用原地址。认证 origin 另按[中继 origin](../methods/authentication-and-sessions.md#中继-origin-计算规则)计算，不代替端点格式校验。

对于本规范未定义的传输格式，验证方必须保留地址原值及其数组位置参与验签，但在本协议中忽略该项，不得尝试连接，也不得将其计入必需地址或 Peer ID 绑定检查；不得仅因其存在拒绝整个描述符。

地址数组的每一项必须为非空字符串，且不得包含重复项。数组顺序不承载业务语义，签名仍保留实际数组顺序。

### 候选选择与重试

同一传输方式可以有多个候选地址；业务连接必须通过相应传输的身份与协议验证。服务端已经返回合法协议响应后，是否改用其他地址重试由相应方法的错误处理和重复请求规则决定；调用方不得把业务错误自动视为地址连接失败。

同一 `RelayDescriptor` 中某种传输方式的候选地址全部失败后，建议调用方刷新 Registry 状态和 `RelayDescriptor`，检查中继资格或服务地址是否发生变化。候选地址都属于同一 `relay_id`；地址切换不改变目标中继，也不表示存在备用中继或服务迁移。

对于可能已被服务端接受的写请求，地址切换后的处理遵循具体方法的重复请求和重试规则。方法明确允许幂等重试时，调用方在新端点满足身份验证及会话要求后，可以向同一中继原样提交请求；幂等保留期、当前授权及其他适用条件仍按该方法执行。其他方法继续按各自要求读取、同步或查询状态后再决定是否继续操作；地址切换本身不授权重放。

## 中继描述符验证规则

验证方必须：

1. 从 `public_key` 派生 Neo 单签账户，并确认其 script hash 等于 `relay_id`；
2. 验证 Neo 账户签名；
3. 确认对应 Registry 记录的 `status` 为 `active`；
4. 按[中继端点地址](#中继端点地址)规则验证 `endpoints`，忽略未知传输项，确认至少包含一个有效的 HTTPS 地址和一个有效的 libp2p TCP multiaddr；
5. 确认 `RelayDescriptor` 尚未到期；
6. 确认 `capabilities` 满足字段定义的约束；使用可选能力前确认 `RelayDescriptor` 包含对应能力声明；
7. 确认所有 libp2p TCP multiaddr 都包含 Peer ID，并且这些 Peer ID 完全相同。

客户端使用 HTTPS 或 WSS 时，必须从已经通过上述验证的 `endpoints` 中选择相应候选地址建立连接。origin 的计算、会话绑定和新建 WSS 连接的认证遵循[会话认证](../methods/authentication-and-sessions.md#会话认证)规则；切换到不同 origin 后，调用需要会话的方法前必须在新 origin 按该方法允许的模式重新认证。

中继使用本描述符所列的 libp2p TCP 地址建立连接时，必须按[中继连接与身份认证](../../relay-dht/concepts/connection-and-authentication.md)完成握手声明和身份验证。每个候选地址中的 Peer ID 都必须与实际安全连接的 Peer ID 相同，并且远端必须支持本规范定义的[中继 DHT 协议](../../relay-dht/README.md)与[中继 RPC 协议](../../relay-rpc/README.md)；不满足条件的连接必须拒绝协议协商或关闭。从 DHT 候选地址开始的身份发现遵循该连接规范。各传输的失败处理、`RelayDescriptor` 刷新和请求重放约束见[中继端点地址](relay-descriptor.md#中继端点地址)。
