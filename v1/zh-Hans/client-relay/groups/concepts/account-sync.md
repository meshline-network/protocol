# 账户内群状态与秘密同步

[群组托管协议](../README.md) · [群组时间线与同步](timeline-and-sync.md)

同一账户的设备通过普通账户消息交换群私有状态，托管中继不参与该同步。账户消息不得携带中继秘密。

群私有状态和历史版本的群应用秘密均可主动发送，并可拆成多条账户消息。接收方独立验证和处理每条消息中的内容；消息身份与去重沿用外层 `MessageEnvelope` 的规则。

## 账户内群私有状态同步

### `AccountGroupPrivateStateRequest`

`AccountGroupPrivateStateRequest` 请求同账户其他设备发送一个群或全部当前群的私有状态。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.account.group.state.request` |
| `group_id` | string | 否 | 只请求该群的当前私有状态；省略时请求接收设备持有的全部当前群私有状态 |

收到请求的设备通过 [`AccountGroupPrivateStateSync`](#accountgroupprivatestatesync) 发送其持有的相应群私有状态。

### `AccountGroupPrivateStateSync`

`AccountGroupPrivateStateSync` 携带一批完整的群私有状态。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.account.group.state.sync` |
| `states` | array&lt;GroupMemberPrivateState&gt; | 是 | 本条账户消息携带的当前群私有状态，必须非空；消息中的 `group_id` 不得重复 |

### `GroupMemberPrivateState`

`GroupMemberPrivateState` 在账户设备间同步一个群的成员私钥及定位信息：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 这份私有状态所属的群 ID |
| `relay_id` | string | 是 | 该群的托管中继 ID；接收方用它定位群接口 |
| `member_encryption_private_key` | string | 是 | 本账户当前成员公钥对应的 32-byte X25519 私钥，使用无 padding base64url；用于解开面向该成员的客户端秘密盒 |

接收方验证账户消息的签名、同账户绑定及字段格式后，保存托管关系和成员私钥。

同一群收到多份私钥时，客户端必须从各私钥派生公钥，按本地已验证成员状态选择与本账户当前成员公钥匹配的私钥，不得以同步消息的到达顺序判断新旧或选择当前私钥。该匹配关系只反映本地已验证到的管理历史；暂时不匹配的私钥可能对应尚未同步的后续状态，可以作为待验证材料保存，不得仅因当前不匹配而认定其过时或无效，也不得用它替换仍与本地当前成员公钥匹配的可用私钥。

客户端通过 `group.sync` 重建成员状态和客户端秘密承诺，再按 [`group.key.sync`](../methods/keys.md#groupkeysync) 的规则，使用与对应历史版本成员公钥匹配的私钥解开密钥盒。当前私钥不保证能解开历史密钥盒。回放到早期公钥时，不据此判定收到的其他私钥无效。

## 账户内群历史秘密同步

长期消息历史由客户端负责。同账户设备可以独立交换已为历史版本派生的群应用秘密：

### `AccountGroupHistorySecretSync`

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.account.group.history_secret.sync` |
| `secrets` | array&lt;GroupHistorySecret&gt; | 是 | 本条消息携带的已验证历史应用秘密，必须非空；同一消息中 `(group_id, epoch)` 不得重复 |

### `GroupHistorySecret`

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 历史应用秘密所属群 |
| `epoch` | integer | 是 | 该应用秘密对应的群密钥版本 |
| `application_secret` | string | 是 | 按 [群应用秘密派生](model-and-keys.md#群应用秘密派生)规则派生的 32-byte 秘密，使用无 padding base64url |

接收方通过账户消息认证并验证字段格式后，可以先暂存历史秘密；本地尚未同步到对应管理事件时，不得仅因暂时未知该密钥版本而判定材料无效。启用前必须依据已验证管理历史确认该群存在对应 `epoch`，并把秘密限制用于该群和版本。

暂存历史秘密不推进管理链头或事件同步位置。同步历史秘密不授予接收设备从托管中继读取群事件或密钥材料的权限；相关读取仍须通过当前成员资格和设备访问检查。
