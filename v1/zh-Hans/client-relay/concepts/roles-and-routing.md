# 角色、路由与信任边界

[客户端—中继协议](../README.md)

## 角色

### 基础实体

**账户（Account）**
Meshline 的长期区块链地址身份，由账户密钥持有者控制，规范标识见[账户 ID](../core-objects/accounts-and-devices.md#账户-id)。账户密钥用于授权设备和签署账户路由，不用于日常消息加密。

**设备（Device）**
账户授权的客户端实例。设备持有自己的签名密钥和密钥交换密钥；`device_id` 从 `DeviceCertificate` 中的稳定身份字段派生。

**客户端（Client）**
代表一个账户和设备运行的终端程序。客户端通过 HTTPS/WebSocket 使用经 Registry 和 `RelayDescriptor` 验证的公共中继。客户端不直接参加中继 DHT。

**公共中继（Relay）**
实现客户端—中继协议并加入中继覆盖网络的服务器。每个中继使用一个 Neo 账户作为协议身份，`relay_id` 是该账户 script hash 的规范文本形式；中继同时具有独立且稳定的 libp2p Peer 身份。

### 调用与路由角色

**调用账户与调用设备**
调用账户是发起客户端方法的账户，调用设备是该账户实际用于本次调用的设备。中继通过有效设备会话确认账户 ID 和设备 ID：HTTP 请求使用 `X-Meshline-Session`，WebSocket 请求使用本连接完成 `auth.device.verify` 后绑定的身份。本协议要求某个请求或对象由调用设备签署时，其设备签名和携带的 `DeviceCertificate` 必须对应本次调用设备。账户会话只证明账户密钥持有者，不能确认调用设备。两种会话的权限见[会话模式](discovery-and-sessions.md#会话模式)；建立、有效期和撤销规则见[会话认证](../methods/authentication-and-sessions.md#会话认证)。

**归属中继（Home Relay）**
账户通过 [`AccountRoute`](../../relay-dht/core-objects.md#accountroute) 指定的账户状态与消息中继。当前有效路由指定的归属中继称为当前归属中继。它保存该账户的当前 `AccountDeviceState`、资料和有限期消息时间线，并与账户共同签署和发布路由。

**源中继（Source Relay）**
接收客户端请求并发起中继间请求的中继。跨中继消息投递的源中继必须在接受 `message.send` 时是发送账户的当前归属中继。

**目标中继（Destination Relay）**
目标账户当前路由中 `relay_id` 指定的当前归属中继。它验证中继间请求并执行查询或投递。

## 调用与路由模型

账户设备状态、资料操作和 `message.send` 提交给账户的当前归属中继。消息时间线按 [`message.timeline.sync`](../methods/messaging.md#messagetimelinesync) 规定向保存相应记录的中继读取。查询其他账户的资料或设备时，可以提交给当前连接中继。需要访问其他中继时，源中继解析目标账户的 [`AccountRoute`](../../relay-dht/core-objects.md#accountroute)，再直接连接目标归属中继。`message.send` 的重试适用[幂等规则](message-delivery.md#消息幂等重试)。`message.delivery.status` 直接向接受相应发送请求的中继查询。消息不得沿 DHT 查询路径逐跳转发。

频道和群组客户端分别直连引用中 `relay_id` 指定的托管中继，不经过账户路由 DHT 或账户消息时间线。

当前连接中继验证本地会话，并按具体方法承担请求设备的授权检查。目标归属中继必须独立验证路由、请求参数和业务授权；只有具体方法明确要求时，才另外查询请求设备的当前状态。

## 信任边界

账户私钥只用于共同签署 `DeviceCertificate`、签署完整 `AccountDeviceState`、账户路由和账户密钥 challenge 等账户级对象。设备先签署自己的有限期证书，账户再确认该设备和有效期；设备密钥签署资料、联系人授权、群请求、群应用密文和其他日常对象。账户设备状态决定哪些证书当前有效，历史签名仍由对象或群事件保存的完整证书验证。区块链共识状态是公共中继成员目录的授权根；[`AccountRoute`](../../relay-dht/core-objects.md#accountroute) 由账户授权，并由其中指定的中继共同签署和发布。

DHT 节点、中继及其保存的协议状态、源中继和传输网络均不属于用户身份或消息机密性的信任根。Noise 保护中继连接的机密性与完整性；端到端加密信封保护消息正文不被任何中继读取。

恶意中继可以拒绝服务，也可能违反托管协议规则，但无法伪造账户或设备签名、读取端到端加密正文，或让其他中继接受不满足其独立验证规则的跨中继请求。
