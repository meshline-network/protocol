# 群组核心对象

[群组托管协议](README.md)

## 群组 ID

创建者生成新的 16-byte `nonce`；同一创建者在同一中继下的 `nonce` 不得重复，推荐使用密码学安全随机源生成。对以下群标识对象的[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)计算 SHA-256：

```json
{
  "$type": "meshline.group.identity",
  "creator": "neo:860833102:...",
  "nonce": "base64url...",
  "relay_id": "0x..."
}
```

`creator` 是首次创建群的 owner，`relay_id` 是选定的托管中继；二者和 `nonce` 在群生命周期内不变。群 ID 按以下公式派生，其中 `group_identity_input` 表示上述群标识对象：

```text
group_id = "grp_" + base64url(first_16_bytes(SHA-256(network_bound_json_bytes(group_identity_input))))
```

`group_id` 必须匹配 `^grp_[A-Za-z0-9_-]{22}$`。名称、简介、成员、容量、邀请策略、事件位置和密钥版本不参与派生。群 ID 与托管中继绑定，但不能从 ID 反推出中继。

## `GroupState`

`GroupState` 是托管中继维护的当前群状态：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 当前状态所描述的群 ID |
| `name` | string | 是 | 当前群的名称；必须至少包含一个非[空白字符](../../general.md#文本空白字符)，UTF-8 编码后最多 256 bytes |
| `description` | string | 是 | 当前群的简介；非空时不得仅包含[空白字符](../../general.md#文本空白字符)，UTF-8 编码后最多 4 KiB（4,096 bytes） |
| `status` | string | 是 | 群的生命周期状态：`active` 表示群仍在存续；`closed` 表示群已永久关闭 |
| `owner` | string | 是 | 群主账户；必须在当前成员投影中恰好出现一次，且对应角色必须为 `owner` |
| `member_capacity` | integer | 是 | 该群的成员数上限，必须为正；可以暂时小于成员数，此时保留现有成员但拒绝继续准入 |
| `member_count` | integer | 是 | 当前成员数量，包括 owner 和 administrator；必须为正 |
| `invite_policy` | string | 是 | 群邀请策略；owner 和 administrator 不受该字段限制 |

`invite_policy` 的含义为：

| 值 | 普通成员可以创建的邀请 |
|---|---|
| `administrators` | 不可以创建邀请 |
| `members_targeted` | 只能创建指定 `invitee` 的定向邀请 |
| `members_shareable` | 可以创建定向邀请，也可以创建公开邀请 |

成员投影按群 ID 和账户 ID 区分成员，包含 `account`、`role` 和 `member_encryption_public_key`。客户端从已验证的[管理链](#客户端验证与恢复)建立成员资格、角色和公钥。

群存续期间，中继必须保留当前状态和成员投影。改变状态的方法必须使投影更新与对应事件追加原子生效。

## `GroupEvent`

`GroupEvent` 是托管中继追加的权威时间线条目，用于记录群管理操作、密钥轮换和群消息：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `sequence` | integer | 是 | 中继为该事件分配的唯一时间线位置；创建事件固定为 0，后续值必须严格大于此前时间线头但不要求连续。客户端用它排序、分页和引用群消息 |
| `epoch` | integer | 是 | 该事件完成后群所处的[密钥版本](concepts/model-and-keys.md#客户端秘密与中继秘密)；创建事件为 0，消息事件必须等于其信封版本；未推进密钥的事件保持完整群时间线中前一事件的版本 |
| `payload` | object | 是 | 完整事件正文，通过 `payload.$type` 识别类型；正文结构与处理规则见对应对象或方法定义 |
| `accepted_at` | integer | 是 | 中继接受该事件的 UTC Unix 秒；用于保留期限，不替代 `sequence` 的排序语义 |
| `signer_device_id` | string | 条件 | 中继接受客户端写请求时验证的设备 ID；客户端发起的事件必须提供并引用 `group.sync` 响应中的证书，中继主动轮换必须省略 |

完整群时间线中的 `epoch` 单调不减，但不要求连续。

消息事件是 `payload.$type = meshline.group.message` 的事件，可以按[群组数据保留与访问规则](concepts/timeline-and-sync.md#群组数据保留与访问规则)到期清理。其他事件属于管理事件，连同其验签证书永久保留。

消息过滤或裁剪、以及客户端从中途读取，可能使相邻可见事件并非时间线中的相邻事件。管理事件不受消息访问区间限制且不得裁剪；从创建开始完整同步时，客户端可以取得全部管理事件。密钥版本的处理遵循 [`group.sync`](methods/lifecycle-and-sync.md#groupsync)。

邀请创建与撤销、申请提交或拒绝、成员密钥重置请求的提交、替换、撤回或拒绝，以及客户端秘密轮换 prepare 不写入时间线。这些待处理记录由批准者在操作时验证；入群批准事件记录已经授权的账户和公钥，成员密钥重置批准事件记录账户和新公钥。封禁和解除封禁影响后续操作权限，成功调用必须将完整签名请求写入管理链。

### 中继秘密轮换事件

中继主动更换中继秘密时生成以下 `payload`：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.key.rotated` |

新密钥版本由外层 `GroupEvent.epoch` 表达。该正文由托管中继生成，不携带 `device_signature`，外层事件必须省略 `signer_device_id`。客户端验证正文的固定值及事件的密钥版本推进关系。该事件永久保留，但不改变成员、角色、封禁、客户端秘密承诺或管理链头。

## 管理链

### 参与事件与前序引用

管理链只连接客户端签署并实际写入时间线的管理事件。消息事件和中继主动轮换不推进这条链。下列正文类型参与管理链：

| 正文 `$type` | 生效内容 |
|---|---|
| `meshline.group.create` | 建立群、初始 owner 和客户端秘密承诺 |
| `meshline.group.application.approval` | 批准成员加入 |
| `meshline.group.update` | 修改群属性 |
| `meshline.group.role.update` | 修改管理角色 |
| `meshline.group.owner.transfer` | 转让所有权 |
| `meshline.group.member.leave` | 签署账户离群 |
| `meshline.group.member.removal` | 移除目标成员 |
| `meshline.group.member.recovery.approval` | 批准成员新公钥 |
| `meshline.group.secret.rotation` | 更新客户端秘密承诺及可选 owner 公钥 |
| `meshline.group.member.ban` | 封禁目标账户并移除其中的当前成员 |
| `meshline.group.member.unban` | 解除封禁 |
| `meshline.group.close` | 永久关闭群 |

创建请求是管理链起点，不携带 `prev_hash`。其余上述请求的签名正文必须携带 `prev_hash`，其值为本地已验证的上一项管理链摘要，匹配 `^sha256:[A-Za-z0-9_-]{43}$`，解码结果必须为 32 bytes 且符合无 padding base64url 的规范编码。`prev_hash` 与全部业务字段一同由调用设备签署，不能由中继在验签后补充或改写。未写入时间线的请求不推进管理链；消息信封及中继主动轮换正文不定义此字段。

### 管理链摘要计算

管理事件 E 对完整 `payload` 的网络绑定 JSON 输入计算哈希，输入保留根 `device_signature` 和所有未知属性：

```text
management_hash(E) = network_bound_json_hash(E.payload)
```

输入构造遵循[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)规则。摘要包括正文签名；计算正文签名时只排除根 `device_signature`。`signer_device_id` 用于定位验签证书，客户端仍须验证证书、正文签名及所属账户的操作权限；其余外层字段继续按排序、时间和密钥规则校验。下一项管理操作引用 `management_hash(E)`。

### 中继提交与并发控制

中继必须验证会话、设备签名及调用权限；创建请求按 [`group.create`](methods/lifecycle-and-sync.md#groupcreate) 的规则建立链起点。对其他请求，中继必须确认 `prev_hash` 等于当前管理链头，且操作生效时调用权限与该匹配关系仍然成立。违反 `prev_hash` 字段约定时返回 `bad_request`。

上述请求成功时必须追加管理事件并更新管理链头。请求证据、状态、事件，以及时间线头和管理链头必须原子提交。

两个请求引用同一链头时，只能有一个成功；另一个如需重新提交，应先同步新事件、重新核对权限与操作内容，再重新签名。客户端不得只替换摘要而复用旧签名。

### 客户端验证与恢复

#### 管理链验证与状态重建

客户端第一次从创建事件开始验证：核对预期群 ID 的派生关系、创建者账户、设备证书和建群签名，建立初始状态并计算链头；随后逐项验证 `prev_hash`、签名、签署账户在前序状态中的成员资格、角色及封禁状态，再按对应方法应用结果并计算新链头。

成员按账户区分，同一账户不得重复；角色为 `owner`、`administrator` 或 `member`。建群事件建立初始 owner；入群批准建立普通成员；角色更新、所有权转让、成员离开、移除或封禁、密钥重置批准和客户端秘密轮换按各方法改变成员状态。成员重新加入时使用新批准的公钥，不能恢复其此前的成员记录。待审批申请或重置请求不改变已生效状态。

封禁集合在创建时为空。客户端通过 [`group.sync`](methods/lifecycle-and-sync.md#groupsync) 取得管理事件，按已验证管理链中的封禁和解除封禁请求分别加入和移除目标账户，由此重建封禁名单。

申请者和请求重置密钥的成员签署包含公钥的完整业务请求。批准者独立验证请求签名、设备证书及请求账户绑定后，在批准对象中签署该账户和公钥。其他客户端验证批准事件及批准者在前序状态中的权限。封装客户端秘密时，目标成员公钥的来源与验证必须遵循[客户端秘密盒](concepts/model-and-keys.md#客户端秘密盒)规则。

#### 验证中断与恢复

中间管理事件缺失、无效签名、无权限操作或不能解释的管理扩展会阻止后续状态验证，不得按普通消息的拒绝规则越过它。遇到未知的客户端管理正文类型时，客户端必须暂停管理投影；扩展定义其哈希参与和状态规则后才能继续。客户端可以保留相应事件，便于后续重新处理。未知属性仍参与哈希和签名，但仅按已知方法定义的字段改变状态。

客户端重新加载本地状态时，必须保证已验证管理链头、成员投影、封禁状态及同步位置保持一致；后续处理继续已验证的管理链，不能以中继快照覆盖。管理链校验失败时，停止应用后续管理事件并报告错误；缺失记录可以通过 [`group.sync`](methods/lifecycle-and-sync.md#groupsync) 重新请求。
