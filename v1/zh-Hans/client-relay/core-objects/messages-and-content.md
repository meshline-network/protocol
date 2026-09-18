# 消息与内容核心对象

[客户端—中继协议](../README.md) · [核心对象索引](README.md)

## 消息 ID

发送方为每条新消息生成 16-byte 值，以无 padding base64url 编码并添加 `msg_` 前缀，必须匹配 `^msg_[A-Za-z0-9_-]{22}$`，区分大小写。发送方必须保证账户范围内每条新消息的消息 ID 不重复，推荐使用密码学安全随机源生成。

## 消息信封与端到端加密

### 加密消息信封

#### `MessageEnvelope`

`MessageEnvelope` 是账户消息使用的不可变签名对象。客户端提交、中继间投递及账户消息时间线共用同一份完整信封，用于消息路由、排队、去重和签名验证。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.message.envelope` |
| `message_id` | string | 是 | 发送账户范围内的[消息 ID](#消息-id) |
| `created_at` | integer | 是 | 发送设备创建并签署本信封的 UTC Unix 秒；源中继和目标中继分别以自己的时钟容错与消息递送期限策略验证 |
| `from` | string | 是 | 发送账户的[账户 ID](accounts-and-devices.md#账户-id) |
| `from_device_id` | string | 是 | 从发送设备的 `DeviceCertificate` 派生的[设备 ID](accounts-and-devices.md#设备-id) |
| `to` | string | 是 | 目标账户的[账户 ID](accounts-and-devices.md#账户-id) |
| `payload` | EncryptedPayload | 是 | 加密后的完整 JSON 业务对象 |
| `device_signature` | string | 是 | `from_device_id` 对应设备对当前 `MessageEnvelope`（排除本字段）生成的 64-byte Ed25519 签名，无 padding base64url |

完整对象的 Canonical JSON UTF-8 编码不得超过 256 KiB（262,144 bytes）。签名输入遵循[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)规则。

验证方必须按 [`DeviceCertificate`](accounts-and-devices.md#devicecertificate) 完成证书的签名和身份绑定验证，确认证书的账户和派生设备 ID 分别与 `from`、`from_device_id` 一致。

`created_at` 表示消息信封的客户端创建时间，用于验证消息是否仍可递送，不用于排序账户时间线或计算时间线记录的保留期限。接受、重试及过期处理见[消息投递](../concepts/message-delivery.md)。

证书签名有效不等于设备当前有权限。当前有效设备的判定见 [`DeviceCertificate`](accounts-and-devices.md#devicecertificate)；通过会话处理请求时，遵循[设备会话规则](../methods/authentication-and-sessions.md#会话有效性与连接绑定)及具体方法的授权要求。

#### `EncryptedPayload`

`EncryptedPayload` 是加密消息的密文容器，使用 32-byte 消息密钥加密一个完整消息业务对象。账户消息的随机内容密钥（content key）通过设备密钥盒分发，规则见[端到端加密构造](#端到端加密构造)。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `alg` | string | 是 | 认证加密算法，固定为 `AES-256-GCM` |
| `nonce` | string | 是 | 12-byte 随机 nonce，以无 padding base64url 编码 |
| `ciphertext` | string | 是 | 完整 JSON 业务对象按[JSON](../../general.md#json-与字段表示)序列化得到的 UTF-8 bytes 经加密后的结果，后接 16-byte GCM 认证标签，整体以无 padding base64url 编码 |

每条新消息的 nonce 必须由密码学安全随机源生成。同一密钥和 nonce 组合不得用于加密不同输入。

#### `MessageKeyBox`

`MessageKeyBox` 为指定账户下的一台设备封装消息内容密钥。发送方使用该设备证书中的 X25519 加密公钥生成它，持有对应私钥的设备可以解封。密钥盒的上下文绑定遵循[端到端加密构造](#端到端加密构造)，不得跨消息、账户或设备复用。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `device_id` | string | 是 | 从接收设备的 `DeviceCertificate` 派生的[设备 ID](accounts-and-devices.md#设备-id) |
| `alg` | string | 是 | 密钥封装构造，固定为 `X25519-HKDF-SHA256-AES256GCM` |
| `enc` | string | 是 | 发送方为本接收设备生成的临时 X25519 公钥；32 bytes，无 padding base64url |
| `sealed_key` | string | 是 | 使用本密钥盒派生的封装密钥（wrapping key）加密封装消息内容密钥的结果；按 12-byte nonce、32-byte ciphertext 和 16-byte GCM tag 的顺序拼接，整体使用无 padding base64url 编码 |

同一组密钥盒中的 `device_id` 不得重复。

#### 收件方消息密钥盒

发送方为目标账户设备生成 `MessageKeyBox` 数组，并通过 `message.send` 请求中的 `recipient_boxes` 提交。该数组非空、最多 8 项。每个密钥盒都以消息信封指定的目标账户作为可解密账户。

消息的端到端语义以账户为目标，密钥盒只是把同一个内容密钥分发给该账户设备的投递材料。每个密钥盒的 KDF 和认证加密上下文按[端到端加密构造](#端到端加密构造)生成；中继不能在不知道内容密钥的情况下为其他设备构造可以解密 payload 的有效密钥盒。中继删除或损坏密钥盒只能使相应设备无法取得消息，不能读取或改变消息正文。

#### 发送方消息密钥盒

发送非自身消息时，客户端可以为发送账户的当前设备封装同一个内容密钥，并把所得 `MessageKeyBox` 数组作为 `message.send` 请求的 `sender_boxes` 提交给发送账户的当前归属中继。它们使发送账户的其他设备能够在有限保留期内恢复原消息内容。

发送方密钥盒出现时，数组必须非空、最多 8 项；其中至少一台设备必须在中继接受请求时的发送账户当前权威设备状态中有效。部分设备不可用不影响整条消息的接受；不可用设备不能读取发件记录。密钥盒不要求覆盖全部当前设备。账户自身投递的发送账户和接收账户相同，`recipient_boxes` 就是该时间线记录的本账户密钥盒，因此必须省略发送方密钥盒。

发送方密钥盒按[端到端加密构造](#端到端加密构造)生成。上下文中的原消息信息取自原信封，`account` 使用原信封的发送账户。

发送方密钥盒没有独立签名，由发送请求的设备会话确认来源。客户端按[消息时间线处理流程](../concepts/message-timeline.md#消息时间线处理流程)验证并恢复发件记录。

### 端到端加密构造

#### 消息内容加密

发送方为每条消息生成随机 32-byte 内容密钥。密钥盒指向的设备在投递前失效不影响 payload 或信封签名的有效性。

业务对象按[JSON](../../general.md#json-与字段表示)序列化为 UTF-8 bytes，并使用 AES-256-GCM 加密。消息 AAD 是以下对象的[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)所产生的 Canonical JSON UTF-8 bytes：

```json
{
  "$type": "meshline.message.aad",
  "$context": "neo:860833102:0x...",
  "message_id": "msg_...",
  "created_at": 1750000000,
  "from": "neo:860833102:...",
  "from_device_id": "dev_...",
  "to": "neo:860833102:..."
}
```

`$type` 固定为 `meshline.message.aad`，用于区分消息加密 AAD 与其他网络绑定密码学输入。`$context` 由可信网络上下文构造并校验。收件方和发送方均从原信封及可信网络上下文独立重建消息 AAD，并将这些 bytes 作为 AES-GCM 的附加认证数据；取得内容密钥后，只有认证成功才能使用解密明文。

#### 设备密钥盒封装

为每个接收设备生成一个临时 X25519 密钥对，并与该设备证书中的加密公钥计算共享秘密（shared secret）。发送方和接收方均必须按 [X25519 共享秘密校验](../../general.md#x25519-共享秘密校验)拒绝全零运算结果，通过后才能用于下述 HKDF。KDF info 和密钥盒 AAD 使用同一份网络绑定 JSON 输入：

```json
{
  "$type": "meshline.message.key_box.aad",
  "$context": "neo:860833102:0x...",
  "alg": "X25519-HKDF-SHA256-AES256GCM",
  "payload_alg": "AES-256-GCM",
  "message_id": "msg_...",
  "created_at": 1750000000,
  "from": "neo:860833102:...",
  "from_device_id": "dev_...",
  "account": "neo:860833102:...",
  "device_id": "dev_...",
  "enc": "..."
}
```

| 参数 | 取值或构造规则 |
|---|---|
| KDF IKM | 上述 X25519 计算得到的共享秘密； |
| KDF salt | `SHA-256(UTF8("Meshline/keybox-salt/v1"))`； |
| KDF info | 上述对象的 Canonical JSON UTF-8 bytes； |
| 封装密钥 | HKDF-SHA-256 输出 32 bytes； |
| 密钥盒 AAD | 与 KDF info 相同的 bytes； |
| `sealed_key` | 使用封装密钥、随机 12-byte nonce 和上述密钥盒 AAD，通过 AES-256-GCM 加密内容密钥，并按 [`MessageKeyBox`](#messagekeybox) 定义的格式封装结果。 |

`$type` 固定为 `meshline.message.key_box.aad`；`$context` 由可信网络上下文构造并校验。`account` 为可解密密钥盒的账户。

#### 随机源与接收方校验

随机内容密钥、nonce 和临时 X25519 私钥必须来自密码学安全随机源。接收方必须先验证信封签名，再解封密钥盒，并使用从信封及可信网络上下文重建的消息 AAD 认证和解密 payload；任一验证失败时不得向应用层返回部分明文。

## 消息明文对象

### 信封内业务对象

每个 `MessageEnvelope` 的加密明文是一个完整的 JSON 业务对象。该对象的根必须包含字符串 `$type`；接收设备解密后按完整 `$type` 字符串选择相应的对象结构和验证规则，遵循[对象类型](../../general.md#对象类型)。

协议定义的加密业务对象如下：

| 业务对象 `$type` | 对象 |
|---|---|
| `meshline.message.direct` | [`DirectMessage`](#directmessage) |
| `meshline.contact.consent` | [`ContactConsent`](../concepts/contacts.md#contactconsent) |
| `meshline.contact.grant` | [`ContactGrant`](../concepts/contacts.md#contactgrant) |
| `meshline.account.contacts.sync` | [`AccountContactSync`](../concepts/contacts.md#accountcontactsync) |
| `meshline.device.state.changed` | [`DeviceStateChanged`](#devicestatechanged) |
| `meshline.account.group.state.request` | [`AccountGroupPrivateStateRequest`](../groups/concepts/account-sync.md#accountgroupprivatestaterequest) |
| `meshline.account.group.state.sync` | [`AccountGroupPrivateStateSync`](../groups/concepts/account-sync.md#accountgroupprivatestatesync) |
| `meshline.account.group.history_secret.sync` | [`AccountGroupHistorySecretSync`](../groups/concepts/account-sync.md#accountgrouphistorysecretsync) |

未知 `$type` 可以作为普通应用消息保存，但接收方不得据此执行协议状态变更。

接收方必须按业务对象对应章节验证其完整结构、固定 `$type`、签名、字段绑定和本地状态前置条件；外层 `MessageEnvelope` 的设备签名不替代业务对象自身规定的签名。中继验证过某种投递凭据，不表示密文一定包含某种业务对象，接收方不得把投递成功作为业务对象有效性的证明。

本规范已定义的业务对象中，账户自身投递只允许 `DirectMessage` 和下列账户同步对象：`AccountContactSync`、`AccountGroupPrivateStateRequest`、`AccountGroupPrivateStateSync` 或 `AccountGroupHistorySecretSync`。这些对象的发送账户和接收账户必须均为本账户，接收方在执行前必须再次确认发送设备仍是本账户当前设备。

账户自身投递还可以携带未知 `$type`；接收方可以将其作为普通应用消息保存或明确忽略，但不得据此执行协议状态变更。消息信封的签名、同账户绑定和密文认证等通用校验仍须通过。

`ContactConsent` 按[联系人关系建立](../concepts/contacts.md#联系人关系建立)的引导准入、声明验证和状态转换规则处理，不要求接收方事先向发送方签发 `ContactGrant`。私聊消息及其他联系人状态对象来自账户间消息时，接收方必须确认本地仍保存由自己签发给信封发送账户且未到期的有效 `ContactGrant`。

### `DirectMessage`

`DirectMessage` 表示一条私聊消息。发送账户和目标账户由外层消息信封确定。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.message.direct` |
| `body` | [MessageBody](#messagebody) | 否 | 纯文本或格式化正文；其中的附件引用遵循[哈希引用规则](#正文中的附件引用)；没有正文时省略 |
| `attachments` | array&lt;ContentReference&gt; | 否 | [媒体或文件附件](#附件处理规则)；没有附件时为空或省略 |
| `reply_to` | DirectMessageReference | 否 | 被回复的私聊消息 |

正文和非空附件数组必须至少提供一项。

#### `DirectMessageReference`

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `from` | string | 是 | 被回复消息的发送账户 |
| `message_id` | string | 是 | 被回复消息的消息 ID |

客户端以 `(from, message_id)` 查找被回复消息。建立回复关系时，`from` 必须是当前私聊双方账户之一；被回复消息必须由该账户发送、属于同一组私聊账户，且类型为 `DirectMessage`。

字段格式有效，但账户或已取得的被回复消息不满足上述条件时，忽略回复关系。`from` 属于当前私聊双方，但被回复消息不在本地历史中时，可以保留尚未解析的回复关系。这两种情况均不得仅因此拒绝当前消息。

### `DeviceStateChanged`

`DeviceStateChanged` 是账户通过端到端加密消息向联系人发送的设备列表缓存失效通知。它不携带设备增量，也不改变账户设备状态；只有当前归属中继接受新的 `AccountDeviceState` 后才能发送。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.device.state.changed` |
| `revision` | integer | 是 | 触发本次通知的已接受 `AccountDeviceState` 的版本；必须是非负[安全整数](../../general.md#安全整数与计数器推进) |

接收方先按[消息时间线处理流程](../concepts/message-timeline.md#消息时间线处理流程)验证并解密消息，完成[信封内业务对象](#信封内业务对象)规定的联系人授权检查，并确认外层信封的发送账户是已有联系人。随后在同一可信网络上下文和该发送账户范围内，将通知的 `revision` 与本地已验证并保存的完整设备状态版本比较；通知版本不高于本地版本时，可以忽略该刷新提示。没有这样的本地状态，或者通知版本更高时，调用 [`device.state.resolve`](../methods/device-state.md#devicestateresolve) 读取并验证完整 `AccountDeviceState`，再以其中当前有效的设备集合替换先前视图。

对同一账户的自动刷新必须限流，并遵循[通知处理规则](../notifications/README.md#通知处理规则)；尚待处理的提示可以按最高通知版本合并。只有读取结果通过验证，且其 `revision` 不低于尚待处理的最高通知版本时，才能确认这些提示已被覆盖；读取期间收到更高版本的通知，或读取失败、结果版本仍较低时，保留刷新需求并补读。通知本身不得作为设备有效性的证据，也不得直接推进本地已验证版本或改变设备权限；忽略或合并提示不得清除其他尚未满足的刷新需求。

## 消息正文

### `MessageBody`

`MessageBody` 同时用于私聊消息、频道帖子和群消息。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `content_type` | string | 是 | 正文的媒体类型，可以包含格式参数；`charset` 参数可以省略，出现时必须为 `utf-8`，值不区分大小写 |
| `text` | string | 是 | 按指定媒体类型解释的原始文本；必须至少包含一个非[空白字符](../../general.md#文本空白字符)；不对文本进行 base64 编码 |

`content_type` 使用 [media type 语法](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1)，类型、子类型和参数名不区分大小写。

Protocol 1.0 的标准客户端支持以下两种正文：

- `text/plain`：按纯文本显示，不解释 Markdown 或 HTML。
- `text/markdown`：`variant=CommonMark` 使用 [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) 语法，省略 `variant` 时也使用该语法。`variant` 的值不区分大小写。

例如，一段 Markdown 正文表示为：

```json
{
  "content_type": "text/markdown; variant=CommonMark",
  "text": "## Release announcement\n\nA **new version** was released today."
}
```

客户端不得执行正文中的脚本、事件处理器或其他主动内容；链接不得执行 `javascript:` 等不安全 URI。未知格式本身不是拒绝消息或阻止时间线同步的理由。

### 正文中的附件引用

Markdown 正文通过附件原文的 SHA-256 摘要引用所属消息或帖子的有效附件集合，使用 [RFC 6920 §3](https://www.rfc-editor.org/rfc/rfc6920.html#section-3) 的 `ni:` URI 格式。

发送方使用 `ni:///sha-256;` 加上附件哈希中 `sha256:` 后的 base64url 摘要生成引用，并确保每个引用都能在所属消息或更新后帖子的有效附件集合中找到唯一目标。同一附件可以被正文多次引用；未被正文引用的附件仍可通过附件列表访问。

例如，附件的 `hash` 为 `sha256:Xj04LbTdg9WapXQnk61reQNAnoZcg7y8VINQSfBDvBU` 时，正文可以写为：

```markdown
![On-site photo](ni:///sha-256;Xj04LbTdg9WapXQnk61reQNAnoZcg7y8VINQSfBDvBU)

[Open original image](ni:///sha-256;Xj04LbTdg9WapXQnk61reQNAnoZcg7y8VINQSfBDvBU)
```

只有所声明 Markdown 格式中的链接或图片目标才能构成 `ni:` 附件引用；代码块、行内代码和被转义的语法不产生附件引用。纯文本及按纯文本降级的未知格式不解释这些引用。

- 本协议的附件引用只接受空 authority、算法名为 `sha-256`、完整 32-byte 摘要的绝对 `ni:` URI，不接受其他算法、截断摘要、额外路径、query 或 fragment。
- URI 的 scheme 不区分大小写；先解析 URI 结构，再对算法名和摘要分别进行一次百分号解码。
- 算法名必须为小写 `sha-256`，摘要必须是无 padding 的规范 base64url，不转换大小写，不重复解码。
- 按算法和解码后的摘要 bytes 与附件的 `hash` 匹配。

私聊消息、群消息和新帖子只匹配自身的附件数组；频道编辑匹配按[编辑规则](../channels/methods/timeline.md#channelpostedit-1)确定的有效附件集合。缺失目标不得从其他消息、帖子、频道、群或全局内容缓存补齐。

客户端不得把 `ni:` 引用交给浏览器或系统 URI 处理器，也不据此执行网络查找；需要下载时，使用匹配附件的 `uri`，并按[附件处理规则](#附件处理规则)完成下载、解密和完整性验证。

哈希引用格式错误、未找到目标或附件暂不可用时，客户端保留原始正文，不得猜测目标、回退为外部地址或因此阻止已经验证的消息及事件完成同步。这些引用或读取失败不改变签名或密文验证结果；附件对象自身字段无效或哈希重复仍按对象验证失败处理。

## 外部内容引用

请求外部内容可能向托管方暴露 IP 地址和访问时间，带有接收者专属标识的 URI 还可能被用于追踪访问行为；外部内容也可能消耗大量带宽、存储或解码资源。端到端加密和附件摘要校验不能隐藏这些外部请求信息。

### `ContentReference`

`ContentReference` 表示一个未直接内嵌在协议对象中的外部内容。它不是内容本身，也不证明 URI 的长期可用性、所有权或访问权限。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `uri` | string | 是 | 获取外部内容的绝对 HTTPS URI |
| `hash` | string | 是 | 外部内容原文的 SHA-256 摘要 |
| `content_type` | string | 是 | 原文的媒体类型，必须符合 [media type 语法](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1)；允许语法有效的自定义类型 |
| `size` | integer | 是 | 原文 bytes 长度，非负 |
| `encryption` | ContentEncryption | 否 | 外部内容加密参数；省略表示 `uri` 直接返回原文 |

获取外部内容时，初始请求及每次重定向后的请求都必须使用 HTTPS。跟随重定向前，必须将目标解析为绝对 URI；若其 scheme 不是 HTTPS，必须停止下载，不得向该目标发起请求。

内容引用本身不授权接收方访问 URI。内容加密参数中的密钥对能够读取 `ContentReference` 的主体可见，因此只有包含该引用的协议对象本身受到适当保密保护时，外部内容才具有机密性。

### `ContentEncryption`

`ContentEncryption` 是 `ContentReference` 所指外部内容的 AES-256-GCM 加密参数。它携带随机内容密钥而不是逐设备密钥盒；接收方从已经验证并按需解密的业务对象中取得引用，再使用这里的密钥解密外部内容。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `alg` | string | 是 | 认证加密算法，固定为 `AES-256-GCM` |
| `key` | string | 是 | 由密码学安全随机源为本内容独立生成的 32-byte AES key，无 padding base64url |
| `nonce` | string | 是 | 本内容独立生成且不得与同一 key 重复使用的 12-byte nonce，无 padding base64url |

#### 加密 AAD 构造

加密方先根据原文计算 `hash` 和 `size`，再把下列对象的 Canonical JSON UTF-8 bytes 作为 AES-GCM AAD：

```json
{
  "$type": "meshline.content.reference.aad",
  "alg": "AES-256-GCM",
  "hash": "sha256:...",
  "content_type": "image/png",
  "size": 12345
}
```

`$type` 固定为 `meshline.content.reference.aad`。

#### 密文格式与解密验证

`uri` 返回的加密内容格式是 `ciphertext || 16-byte GCM tag`；ciphertext 长度与原文 `size` 相同。接收方使用 `key`、`nonce` 和相同 AAD 解密，通过 GCM 认证后仍必须验证原文长度等于 `size` 且 SHA-256 摘要等于 `hash`。任一检查失败都必须拒绝该内容。

### 附件处理规则

私聊消息、频道帖子、群消息均通过 `attachments` 数组携带 `ContentReference`，图片、音频和视频不嵌入 `MessageBody`。附件与正文均使用 `content_type` 标识媒体类型；附件类型例如 `image/png`、`audio/ogg`、`video/mp4`。客户端可以按附件类型提供预览或播放，不支持的类型或编码仍可作为普通文件处理。

同一业务对象的附件数组中，`hash` 不得重复，即使下载地址、媒体类型或加密参数不同也不例外。哈希绑定原文 bytes，不绑定存放位置或加密方式，因此重排附件、更换下载地址或重新加密不改变正文引用。找到匹配条目不代表已经取得可信内容，仍必须验证下载内容的 `hash` 和 `size`。

发送方通过消息或帖子中的完整 `ContentReference` 引用外部 HTTPS 位置的附件。需要保密的消息附件必须按 [`ContentEncryption`](#contentencryption) 使用独立随机密钥加密，不得直接使用消息内容密钥、客户端群秘密或群应用秘密作为附件密钥。频道附件是公开内容，可以不加密；即使加密，公开引用中的密钥也对所有读者可见。

接收方先验证包含引用的消息或事件，并按需解密消息，再根据用户操作或本地附件下载策略取得附件。附件必须通过认证解密（如有）、原文长度和摘要检查后才能预览、播放或交给应用使用；不得仅凭 URI 后缀或下载响应的媒体类型跳过验证。客户端不得在接收、下载或预览附件时自动执行其中的脚本等主动内容。

附件下载失败、内容已经清理或本地不支持预览，不使已经验证的消息或事件失效；客户端可以保存引用及附件状态后完成同步。中继接受消息或帖子不要求先下载外部附件。
