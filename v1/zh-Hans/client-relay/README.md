# 客户端—中继协议

[Meshline Protocol 1.0](../README.md)

协议标识与 HTTP 基路径：`/meshline/v1`

Meshline 客户端通过经 Registry 与 `RelayDescriptor` 验证的 HTTPS 或 WSS endpoint 使用本协议。基础模块由所有公共中继提供；频道和群组托管是共享同一传输、会话、错误和方法命名空间的可选模块。

WebSocket 按 [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455) 执行；WSS 方法与通知封装按 [JSON-RPC 2.0](https://www.jsonrpc.org/specification) 执行。公共编码和签名输入见[协议总则](../general.md)。

账户是由账户密钥持有者控制的长期区块链身份；设备是持有独立签名与加密密钥的客户端实例；调用设备是客户端实际用于本次调用的账户设备，中继通过有效设备会话确认其身份。账户选择的当前归属中继保存其权威设备状态、资料和有限期消息时间线，并接受该账户的 `message.send`。客户端可以经当前连接中继查询其他账户的资料和设备；跨中继发送消息时，由发送账户的归属中继解析目标账户路由，再通过中继 RPC 直接投递给目标归属中继。

客户端不参加中继 DHT。频道和群组操作分别直连引用指定的托管中继，不经账户路由或账户消息时间线。中继提供相应托管服务时，必须完整实现模块，并在有效 `RelayDescriptor` 中发布相应能力声明。详细角色、路由和信任边界见[角色、路由与信任边界](concepts/roles-and-routing.md)。

## 协议内容

### 概念与核心对象

| 部分 | 内容 |
|---|---|
| [角色、路由与信任边界](concepts/roles-and-routing.md) | 基础实体、调用与路由角色、请求路由模型及信任边界 |
| [发现与会话](concepts/discovery-and-sessions.md) | 中继发现、会话模式及会话信任边界 |
| [账户与设备生命周期](concepts/account-and-device-lifecycle.md) | 账户设立、设备变更与恢复、本地路由验证和归属中继迁移 |
| [联系人与授权](concepts/contacts.md) | 联系人引导、关系状态、授权对象和账户内同步 |
| [消息投递](concepts/message-delivery.md) | 投递过程、结果、幂等、保留期和重试 |
| [账户消息时间线](concepts/message-timeline.md) | 时间线模型、设备可见范围、保留与历史缺口、记录结构和处理流程 |
| [核心对象](core-objects/README.md) | 跨方法的中继身份、账户身份、设备状态、资料、消息信封、明文消息与内容引用 |

### 方法与通知

| 部分 | 内容 |
|---|---|
| [方法公共约定](methods/conventions.md) | HTTP/WSS 请求映射、通用响应和错误 |
| [中继发现与信息方法](methods/relay-information.md) | 中继描述符获取、服务信息与限制查询 |
| [会话认证与生命周期](methods/authentication-and-sessions.md) | 设备与账户认证、会话凭据、有效性与续期 |
| [设备状态方法](methods/device-state.md) | 设备状态发布与预存、自身读取、公开查询和签名查询 |
| [账户资料方法](methods/profiles.md) | 账户资料发布、查询与签名验证 |
| [账户路由方法](methods/account-routing.md) | 账户路由共同签署、发布与查询 |
| [消息方法](methods/messaging.md) | 消息发送、投递状态查询与时间线同步调用 |
| [通知](notifications/README.md) | WebSocket Notification 封装和断线补齐要求 |

## 可选模块

| 协议组成 | 中继声明要求 |
|---|---|
| [频道托管协议](channels/README.md) | `channel.host.v1` |
| [群组托管协议](groups/README.md) | `group.host.v1` |

不识别的能力声明必须忽略。

## 客户端调用

`method` 名称按大小写敏感的完整字符串与所属模块的方法索引匹配。基础模块方法列于本表；`channel.*` 与 `group.*` 方法分别列于频道和群组模块的“方法索引”。

HTTP 列给出各方法使用的 GET、POST、PUT、PATCH 或 DELETE。`N/A` 表示不提供相应传输形式。WebSocket 列为 `JSON-RPC` 表示客户端可以在 WSS endpoint 上以 JSON-RPC Request 调用该方法。“会话模式”列只说明调用方法前必须建立的 中继会话 模式；“无”表示不要求 中继会话。中继没有 WSS endpoint 时，只提供 HTTP 列定义的调用形式，也不发送服务端通知。

| 方法 | HTTP | WebSocket | 会话模式 |
|---|---|---|---|
| [`relay.descriptor`](methods/relay-information.md#relaydescriptor) | GET | JSON-RPC | 无 |
| [`relay.info`](methods/relay-information.md#relayinfo) | GET | JSON-RPC | 无 |
| [`auth.challenge`](methods/authentication-and-sessions.md#authchallenge) | POST | JSON-RPC | 无 |
| [`auth.device.verify`](methods/authentication-and-sessions.md#authdeviceverify) | POST | JSON-RPC | 无 |
| [`auth.account.verify`](methods/authentication-and-sessions.md#authaccountverify) | POST | JSON-RPC | 无 |
| [`device.state.publish`](methods/device-state.md#devicestatepublish) | PUT | JSON-RPC | 设备会话或账户会话 |
| [`device.state.resolve`](methods/device-state.md#devicestateresolve) | GET, POST | JSON-RPC | 设备会话或账户会话 |
| [`profile.publish`](methods/profiles.md#profilepublish) | PUT | JSON-RPC | 设备会话 |
| [`profile.resolve`](methods/profiles.md#profileresolve) | GET | JSON-RPC | 设备会话 |
| [`account.route.publish`](methods/account-routing.md#accountroutepublish) | PUT | JSON-RPC | 账户会话 |
| [`account.route.resolve`](methods/account-routing.md#accountrouteresolve) | GET | JSON-RPC | 无 |
| [`message.send`](methods/messaging.md#messagesend) | POST | JSON-RPC | 设备会话 |
| [`message.delivery.status`](methods/messaging.md#messagedeliverystatus) | GET | JSON-RPC | 设备会话 |
| [`message.timeline.sync`](methods/messaging.md#messagetimelinesync) | GET | JSON-RPC | 设备会话 |

各方法的请求参数到 HTTP body、HTTP query 或 WebSocket `params` 的映射，以及响应和错误处理，统一遵循[方法公共约定](methods/conventions.md)。

## 服务端通知

服务端通知只通过 WebSocket 发送，使用不含 `id` 的 JSON-RPC Notification；HTTP 不提供等价形式。下表列出基础模块通知；频道和群组通知列于各自模块的“通知索引”。

| 通知 | 发送前提 |
|---|---|
| [`device.state.changed`](notifications/README.md#devicestatechanged) | 账户当前归属中继接受新的权威设备状态，且当前连接仍有效 |
| [`message.timeline.changed`](notifications/README.md#messagetimelinechanged) | 设备在账户当前归属中继的 WebSocket 连接上完成认证，且账户消息时间线头可能变化 |

JSON-RPC 封装和连接生命周期见[客户端—中继通知](notifications/README.md)。

## 一致性要求

兼容实现须遵循[一致性测试边界](../test-vectors/README.md#一致性测试边界)，按以下主题验证正文规定的行为：

- 基础对象：按[协议总则](../general.md)和[核心对象](core-objects/README.md)验证编码、类型、网络与身份绑定、嵌套签名、消息 AAD、正文和附件的认证及安全处理。
- 发现与会话：验证[中继发现](concepts/discovery-and-sessions.md)、[描述符与端点](core-objects/relay-descriptor.md)及[认证与续期](methods/authentication-and-sessions.md)；覆盖候选拒绝、relay_id 与 origin 的绑定、两种会话模式、challenge 消费与到期、设备失效和连接切换。
- 设备与资料：按[设备状态方法](methods/device-state.md)及[账户资料方法](methods/profiles.md)验证预存与权威状态、版本防回退和冲突、重复提交、缓存隔离、账户恢复及跨中继响应验证；公开资料读取不放宽设备查询或消息投递权限。
- 联系人：按[联系人与授权流程](concepts/contacts.md)验证公开或邀请引导、关系建立与删除、授权选择及背书合并、设备变更后的授权维护，以及账户内快照、记录版本和删除记录的同步。
- 路由与迁移：验证[路由发布与解析](methods/account-routing.md)及[归属中继变更](concepts/account-and-device-lifecycle.md#归属中继变更)；覆盖原中继不可达、设备状态预存、既有投递责任与结果查询、旧时间线补读及迁回后的序号延续。
- 消息投递：按[投递流程、幂等与重试](concepts/message-delivery.md)验证自身、本地和跨中继投递、收件授权、部分或全部设备失效、两组密钥盒、完整参数比较、结果状态与保留期限，以及响应丢失和重启后的恢复。
- 时间线与通知：按[账户消息时间线](concepts/message-timeline.md)、[消息方法](methods/messaging.md)和[通知规则](notifications/README.md)验证设备可见范围、分页顺序与结束标志、历史缺口、时间线头持久化、同步位置推进，以及通知合并、丢失和读取期间的新提示；不携带状态的设备状态变更通知还须遵循[设备状态变更通知](notifications/README.md#devicestatechanged)。
- 传输与错误：按[方法公共约定](methods/conventions.md)验证 HTTP/WSS 参数与结果等价、无参数调用、JSON 封装、会话权限、分页、时间及资源边界、整数耗尽、错误映射和限流退避。
