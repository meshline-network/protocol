# 群组生命周期与同步方法

[群组托管协议](../README.md) · [方法公共约定](conventions.md)

## `group.create`

调用账户通过 `group.create` 创建群，创建成功后成为群 owner。创建者先生成群 ID、32-byte `client_group_secret` 和成员 X25519 密钥对，按[客户端秘密与中继秘密](../concepts/model-and-keys.md#客户端秘密与中继秘密)规则计算客户端秘密承诺，再为自己的成员公钥封装客户端秘密盒。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/group/create` |
| 会话要求 | 设备会话 |
| WSS | `group.create` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `create` | GroupCreate | 是 | 创建者签署的完整建群对象，原样成为 sequence 0 事件的 `payload` |
| `client_secret_box` | GroupSecretBox | 是 | 创建者的客户端秘密盒 |

`GroupCreate` 字段：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.create` |
| `group_id` | string | 是 | 由初始群主账户、当前托管中继和 `nonce` 按[群组 ID](../core-objects.md#群组-id)规则共同派生的全新群 ID |
| `nonce` | string | 是 | 创建者按[群组 ID](../core-objects.md#群组-id)规则为该群生成的 16-byte 值，使用无 padding base64url；用于派生群 ID，并在群生命周期内保持不变 |
| `name` | string | 是 | 初始群名称；必须至少包含一个非[空白字符](../../../general.md#文本空白字符)，UTF-8 编码后最多 256 bytes |
| `description` | string | 否 | 初始简介；非空时不得仅包含[空白字符](../../../general.md#文本空白字符)，UTF-8 编码后最多 4 KiB（4,096 bytes） |
| `member_capacity` | integer | 是 | 初始成员容量，必须为正且不超过 `relay.info` 声明的最大群成员数；创建者占用其中一个名额 |
| `invite_policy` | string | 是 | 初始成员邀请策略，取值与含义见 [`GroupState.invite_policy`](../core-objects.md#groupstate) |
| `owner` | object | 是 | 初始群主的信息 |
| `client_secret_commitment` | string | 是 | 初始[客户端秘密承诺](../concepts/model-and-keys.md#客户端秘密与中继秘密)，使用 `sha256:` 文本表示 |
| `device_signature` | string | 是 | 由初始群主用于本次调用的设备签署，签名输入是排除本字段后的完整 `GroupCreate` |

`owner` 包含：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | 创建群并成为初始群主的账户；必须是发起本次调用的账户，也是 `group_id` 派生所使用的创建者账户 |
| `member_encryption_public_key` | string | 是 | 初始群主的 32-byte X25519 公钥，使用无 padding base64url |

### 响应对象

无。

### 处理与错误

中继通过设备会话确认调用账户和调用设备，再验证建群签名，确认设备证书中的账户、`owner.account` 和调用账户一致，验证群 ID 确由该账户、当前中继和 `nonce` 派生，并检查初始群主的成员加密公钥和客户端秘密承诺的表示。创建者的密钥盒按[客户端秘密盒](../concepts/model-and-keys.md#客户端秘密盒)规则验证。

请求的固定值、群 ID 派生、名称、简介、容量、邀请策略、密钥、承诺或密钥盒编码不合法时返回 `bad_request`；会话模式不符或初始群主不是调用账户时返回 `forbidden`；群 ID 已经存在或并发创建冲突时返回 `state_conflict`。

成功时，中继根据建群对象中的初始群主信息建立成员记录和创建者设备的访问区间，把建群对象声明的客户端秘密承诺固化为群的当前承诺，生成 epoch 0 的中继秘密，保存初始群主的成员公钥、创建事件的验签证书、epoch 0 密钥条目及初始群主的客户端秘密盒，并原子追加 sequence 0 创建事件。

中继和客户端依据创建事件初始化 `GroupState.description`：`GroupCreate.description` 省略或为 `""` 时设为空字符串，非空合法值原样保留。签名输入、管理链摘要和事件正文必须保留字段省略与显式空字符串的区别，不得补齐或删除字段后验证签名或计算摘要。

## `group.resolve`

查询群的当前状态，供当前成员读取或持有效邀请的非成员在入群前查看。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/group/resolve` |
| 会话要求 | 设备会话 |
| WSS | `group.resolve` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 要读取当前状态的群 ID；必须由当前中继托管 |
| `invite_id` | string | 否 | 非成员用于读取入群前状态的邀请 ID；当前成员可以省略，非成员必须提供一份仍然有效且适用于自己的邀请 |

### 响应对象

返回当前 [`GroupState`](../core-objects.md#groupstate)。

### 处理与错误

当前未被封禁的成员可以直接查询群状态。尚未加入群的账户必须提供一份仍然有效、未撤销、尚有可用次数且适用于自己的邀请；读取状态不消耗邀请次数，也不创建申请。已经被封禁的账户不能通过邀请取得读取权限。

群 ID 或出现的邀请 ID 格式非法时返回 `bad_request`；群不存在时返回 `not_found`；调用账户已被封禁，或者非成员没有提供适用的有效邀请时返回 `forbidden`。

## `group.sync`

按 `sequence` 读取当前设备可见的群时间线，供客户端验证管理链、重建群状态并处理群消息。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/group/sync` |
| 会话要求 | 设备会话 |
| WSS | `group.sync` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 要同步事件的群 ID |
| `after` | integer | 否 | 读取起点；仅返回 `sequence` 大于该值的事件。首次同步省略或使用 `-1`；值不得小于 `-1`，且不得超过当前时间线头；该值不要求对应现存事件 |
| `limit` | integer | 否 | 本页最多返回的事件数；必须为正安全整数，遵循[分页约定](../../methods/conventions.md#分页) |

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `events` | array&lt;GroupEvent&gt; | 是 | 本次读取到的一页事件；按 `sequence` 严格升序，可以为空，不要求相邻数值连续 |
| `certificates` | array&lt;DeviceCertificate&gt; | 是 | 本页事件的 `signer_device_id` 引用的历史签名证书；按派生设备 ID 去重 |
| `has_more` | boolean | 是 | 生成本页时是否还有更多可读事件；空页必须为 `false` |

#### 可读事件与分页

中继返回事件前必须确认账户和设备当前具有群读取权限，并只返回满足请求位置的可读事件。管理事件全部可读，不受设备消息访问区间限制；消息事件仅在设备授权区间内且尚未清理时可读。

`events` 和 `has_more` 必须取自同一读取快照。中继不得跳过仍可读的管理或消息事件。已裁剪或不在授权区间的消息直接跳过，不占页面条目。`has_more = true` 时以本页最后一项的 `sequence` 继续，为 `false` 时本次分页读取结束。

分页读取位置不代表客户端已经完成相应事件的验证和处理；同步位置的推进遵循[群时间线与同步规则](../concepts/timeline-and-sync.md#群时间线与同步规则)。时间线序号间隔本身不表示遗漏。

#### 事件验证与状态重建

没有本地已验证群状态的客户端必须从 `-1` 开始取得创建事件，按[管理链](../core-objects.md#客户端验证与恢复)规则验证预期群身份并逐项重建状态；已有经验证的本地群状态时，客户端可以从与该状态一致的同步位置继续。

客户端按 [`DeviceCertificate`](../../core-objects/accounts-and-devices.md#devicecertificate) 的签名与身份规则验证本页证书，拒绝设备 ID 重复、证书缺失或引用不匹配的响应。对客户端发起的事件，再按 `signer_device_id` 找到证书，使用其中的账户和签名公钥验证 `payload` 的签名；中继主动轮换按[正文定义](../core-objects.md#中继秘密轮换事件)校验。证书后来续期、到期或设备被移除，不否定原事件的签名；历史授权根据管理链中的前序群状态判断。

事件的 `sequence` 严格递增，`epoch` 不得回退。已知推进密钥的事件必须严格增加版本；完整时间线中不推进密钥的事件沿用前一事件的版本。消息信封的 `epoch` 必须等于外层事件，群、设备证书和消息信封签名必须有效。

#### 密钥获取与消息处理

事件和密钥材料可以独立读取。通过同账户消息取得的成员私钥按 [`GroupMemberPrivateState`](../concepts/account-sync.md#groupmemberprivatestate) 的规则验证、保存和使用。

群消息信封通过上述校验，且对应应用秘密可用后，再按[群消息密钥派生与加解密](../concepts/messaging-and-encryption.md#群消息密钥派生与加解密)规则核对发送账户上下文、解密并按业务对象 `$type` 验证所得内容，通过后才能处理。

缺少对应历史私钥或密钥材料时，客户端可以持久化已验证的消息信封，等待后续解密；消息的无效签名、密文认证失败或业务内容错误可以持久化为拒绝结果。所需密钥通过 [`group.key.sync`](keys.md#groupkeysync) 按原密钥权限取得。

### 处理与错误

调用账户必须是当前未被封禁的成员。需要建立新区间的设备，其消息和密钥访问起点按[设备访问区间](../concepts/membership-and-access.md#设备访问区间)建立；同时允许它读取此前全部管理事件。参数或授权校验失败不建立新区间。

群 ID、`after` 或 `limit` 非法，或者请求位置超过当前时间线头时返回 `bad_request`；群不存在时返回 `not_found`；账户已离群、被移除或被封禁，或设备当前无读取权时返回 `forbidden`。

## `group.close`

`group.close` 由当前 owner 永久关闭群。关闭后不得再追加群时间线事件；关闭后的读取服务和消息、密钥保留不作保证。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/group/close` |
| 会话要求 | 设备会话 |
| WSS | `group.close` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.close` |
| `group_id` | string | 是 | 当前 owner 要永久关闭的群 ID |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `device_signature` | string | 是 | 由当前 owner 使用本次调用设备签署，签名输入是排除本字段后的完整关闭请求 |

### 响应对象

无。

### 处理与错误

请求格式或固定值非法时返回 `bad_request`；群不存在时返回 `not_found`；调用账户不是当前 owner 或已被封禁时返回 `forbidden`；并发状态变化或群已经关闭时返回 `state_conflict`。

操作成功时追加最后一个关闭事件、把状态永久改为 `closed` 并关闭所有当前设备访问区间。关闭事件沿用关闭前的 `epoch`。
