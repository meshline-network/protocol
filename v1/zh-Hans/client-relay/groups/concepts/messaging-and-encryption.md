# 群消息与加密

[群组托管协议](../README.md) · [群组模型与密钥](model-and-keys.md)

## `GroupMessageEnvelope`

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.message` |
| `message_id` | string | 是 | 发送账户范围内的[消息 ID](../../core-objects/messages-and-content.md#消息-id) |
| `group_id` | string | 是 | 消息要写入的群；必须与调用目标、签名上下文和最终 `GroupEvent` 所属群一致 |
| `epoch` | integer | 是 | 加密正文时使用的群密钥版本；进入消息密钥派生上下文 |
| `created_at` | integer | 是 | 发送设备创建并签署信封的 UTC Unix 秒；进入消息 AAD |
| `payload` | [EncryptedPayload](../../core-objects/messages-and-content.md#encryptedpayload) | 是 | 加密后的完整业务对象 |
| `device_signature` | string | 是 | 由发送者使用发送设备签署，签名输入是排除本字段后的完整信封；同步方使用事件引用的设备证书验证 |

消息提交及重试规则见 [`group.message.send`](../methods/messaging.md#groupmessagesend)。完整 `GroupMessageEnvelope` 的 Canonical JSON 不得超过 256 KiB。

## 群消息密钥派生与加解密

### 消息 AAD 构造

加密或解密一条群消息时，客户端必须构造以下 `message_aad` 对象。这个对象不属于 `GroupMessageEnvelope`，也不随信封传输；它只用于把消息信封、发送者身份和当前网络绑定到本次密钥派生及密文验证中。

`message_aad` 中的消息字段取自信封，发送账户和设备按以下规则确定：

- 发送方使用设备会话确认的账户和设备 ID 作为 `from` 与 `from_device_id`。
- 接收方先验证事件所在 [`group.sync`](../methods/lifecycle-and-sync.md#groupsync) 响应页的 `certificates`，再按事件记录的操作设备找到对应 `DeviceCertificate`，由此确定 `from_device_id` 与 `from`。

双方必须对以下对象生成[网络绑定 JSON 输入](../../../general.md#网络绑定-json-输入)：

```json
{
  "$type": "meshline.group.message.aad",
  "group_id": "grp_...",
  "epoch": 7,
  "message_id": "msg_...",
  "from": "neo:860833102:...",
  "from_device_id": "dev_...",
  "created_at": 1780000000
}
```

所得 bytes 记为 `message_aad_bytes`。发送账户和设备参与该输入，可防止不同成员或设备复用同一消息 ID 时得到相同的消息密钥。

### 消息密钥派生

客户端使用该消息 `epoch` 对应的 `epoch_application_secret` 按下式派生 32-byte 消息密钥：

```text
message_key = HKDF-SHA-256(
  IKM  = epoch_application_secret,
  salt = SHA-256(UTF8("Meshline/group-message-salt/v1")),
  info = message_aad_bytes,
  L = 32
)
```

### 消息加密与解密

发送方必须按 [JSON 与字段表示](../../../general.md#json-与字段表示)序列化完整业务对象，以所得 UTF-8 bytes 作为 AES-256-GCM 明文，以 `message_key` 为密钥、`message_aad_bytes` 为 AAD，并使用密码学安全随机源生成的 12-byte nonce 加密。结果保存为 `payload`，其中 `alg` 固定为 `AES-256-GCM`，`nonce` 保存本次随机值，`ciphertext` 保存密文及 16-byte tag。随机 nonce 的生成要求遵循 [`EncryptedPayload`](../../core-objects/messages-and-content.md#encryptedpayload)。

接收方验证完整信封签名，按同样的上下文派生消息密钥，再从 `payload.nonce` 取得 nonce，以重建的 `message_aad_bytes` 完成 AEAD 验证。通过后必须把明文解析为 JSON 业务对象，按 `$type` 验证相应结构后再处理；不得执行未通过对象校验的内容。

## 群消息明文对象

每个 `GroupMessageEnvelope` 的加密明文是一个完整的 UTF-8 JSON 业务对象。其根必须包含字符串 `$type`；接收方解密后按完整类型字符串选择对象结构和处理规则：

| 业务对象 `$type` | 对象 |
|---|---|
| `meshline.group.message.content` | [`GroupMessage`](#groupmessage)，普通群聊天内容 |
| `meshline.group.member.nickname.update` | [`GroupMemberNicknameUpdate`](#groupmembernicknameupdate)，发送成员的昵称更新 |

未知 `$type` 可以保存为未识别的业务对象，但不得据此改变协议状态。中继不能解密业务对象，信封被接受不表示其明文业务内容有效。

### `GroupMessage`

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.message.content` |
| `body` | [MessageBody](../../core-objects/messages-and-content.md#messagebody) | 否 | 纯文本或格式化正文；其中的附件引用遵循[哈希引用规则](../../core-objects/messages-and-content.md#正文中的附件引用)；没有正文时省略 |
| `attachments` | array&lt;ContentReference&gt; | 否 | 随消息发送的外部内容引用；没有附件时为空数组或省略 |
| `reply_to_seq` | integer | 否 | 被回复群消息在权威时间线中的 `sequence`；必须是正安全整数，且小于承载当前消息的事件序号 |

正文和非空附件数组必须至少提供一项。附件复用客户端—中继基础协议的 [`ContentReference`](../../core-objects/messages-and-content.md#contentreference) 和[附件处理规则](../../core-objects/messages-and-content.md#附件处理规则)；完整引用与正文一同加密，附件内容本身位于外部 URI，不计入群消息信封大小，引用对象计入。

`reply_to_seq` 满足数值约束时，只有它指向同一群中的群消息事件，且目标业务内容通过认证解密并确认为 `GroupMessage`，客户端才能建立回复关系。目标为管理事件、昵称更新或其他非聊天对象时，忽略回复关系，不得仅因此拒绝当前消息。

满足数值约束的目标事件已经裁剪、不在客户端本地历史中，或目标业务内容因缺少密钥尚未解密时，客户端可以把回复关系保留为尚未解析，不得仅因此拒绝当前消息；后续取得并解密目标时，必须补做上述检查。中继不能解密 `GroupMessage`，不验证正文、附件或回复关系。

### `GroupMemberNicknameUpdate`

`GroupMemberNicknameUpdate` 通过[普通群消息](../methods/messaging.md#groupmessagesend)设置、修改或清除发送成员自己的群昵称：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.member.nickname.update` |
| `nickname` | string 或 null | 是 | 字符串替换本地群昵称；`null` 清除覆盖 |

#### 昵称与发送者校验

字符串必须至少包含一个非[空白字符](../../../general.md#文本空白字符)，UTF-8 编码后最多 256 bytes。合法文本包括首尾空白必须原样保留，不执行 Unicode 归一化。

所属群和发送账户由已验证的消息信封、设备证书及消息 AAD 确定，复用信封设备签名认证发送者。

接收方必须先按 [`group.sync`](../methods/lifecycle-and-sync.md#groupsync) 验证信封、设备证书、历史成员权限和 AEAD，再验证昵称对象，最后按下述规则应用。非法业务内容不得改变群昵称状态，可以持久化为拒绝结果并继续同步；中继不根据密文中的昵称内容返回 `bad_request`。

#### 本地昵称状态

客户端为每个群成员独立保存可选的本地群昵称覆盖值，按 `GroupMemberNicknameUpdate` 设置或清除。显示回退不写入群昵称；账户资料变化和同一账户在其他群内改名，不改变本群已经保存的覆盖值。昵称允许重复，不得用作成员身份或权限判断依据。

群昵称是接收设备根据自己能够读取、验证和解密的消息维护的本地显示状态。不同成员或同一账户的不同设备可以显示不同昵称；协议不提供昵称快照或设备间昵称状态同步。已有客户端可以在中继裁剪消息后继续保留覆盖值。

客户端只采用同一发送账户有效昵称消息中最大的事件 `sequence`，不按接收时间、`created_at` 或解密完成时间判断新旧。延迟解密的旧消息和已经处理过的同一消息不得恢复旧值。缺少密钥时，可以按普通群消息的规则保存已验证的信封，等待后续解密；恢复解密后仍执行上述顺序判断。

角色更新、所有权转让、成员密钥重置及客户端秘密轮换保留本地昵称。成员离开、被移除或被封禁时清除其覆盖值；重新加入从未设置状态开始，解除封禁不恢复旧昵称。
