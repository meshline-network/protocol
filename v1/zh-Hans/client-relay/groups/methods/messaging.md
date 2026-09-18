# 群组消息方法

[群组托管协议](../README.md) · [群组模型与密钥](../concepts/model-and-keys.md) · [方法公共约定](conventions.md)

## `group.message.send`

当前未被封禁的成员使用当前版本的群应用秘密发送新群消息；已经接受的请求按本节的幂等规则重试。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/group/message/send` |
| 会话要求 | 设备会话 |
| WSS | `group.message.send` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

请求参数是 [`GroupMessageEnvelope`](../concepts/messaging-and-encryption.md#groupmessageenvelope)，其密文承载[群消息业务对象](../concepts/messaging-and-encryption.md#群消息明文对象)。发送账户和发送设备由设备会话确认。

本方法在同一网络、同一托管中继内按 `(发送账户, message_id)` 判断重复，具体见[群消息幂等重试](#群消息幂等重试)。

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `sequence` | integer | 是 | 中继为本消息事件分配的时间线位置，必须为正安全整数；发送方可以用它建立 `reply_to_seq` 引用和本地去重关系，但不能据此推进 [`group.sync`](lifecycle-and-sync.md#groupsync) 位置 |

### 处理与错误

对新接受的群消息请求，必须验证完整请求大小和客户端时间、当前成员资格、群是否仍可写、信封的当前 `epoch`，以及发送设备的签名与设备会话是否一致。

信封格式、标识、密文结构或时间字段的类型、表示不合法时返回 `bad_request`；`created_at` 超出中继允许的时钟偏差时返回 `clock_skew`；完整请求或完整 `GroupMessageEnvelope` 超过各自字节上限时返回 `request_too_large`；群不存在时返回 `not_found`；账户不是当前成员或已被封禁时返回 `forbidden`；群已关闭、信封不是当前密钥版本或并发写入冲突时返回 `state_conflict`。

接受消息时，中继必须原子分配严格递增的 `sequence`、追加以原始信封为 `payload` 的消息事件、保存发送设备证书，并更新当前密钥材料的最短保留期限。消息不推进密钥版本。相关状态成功持久化后发送 `group.timeline.changed`。

中继不能解密正文，因此不能根据业务对象中的内容拒绝信封。接收方的消息校验、等待密钥及拒绝处理统一遵循 [`group.sync`](lifecycle-and-sync.md#groupsync)。

### 群消息幂等重试

每次调用仍须通过参数、大小、设备会话、发送设备签名与会话绑定、群归属和当前发送权限的检查。群必须仍在存续，调用账户必须仍是未被封禁的当前成员，调用设备也必须仍有相应权限。群已关闭时返回 `state_conflict`；会话失效、当前权限不足等错误继续按本方法处理，不能用历史接受结果绕过授权。

在幂等结果保留期内，同一逻辑消息键适用以下规则：

- 完整 `GroupMessageEnvelope` 的 [Canonical JSON](../../../general.md#canonical-json) 相同，返回原消息事件的 `sequence`。比较包含签名、未知属性及可选字段的存在性。
- 完整信封不同，返回 `state_conflict`，不得覆盖原信封或接受结果。
- 相同请求不新增事件、分配 sequence、发送变化通知或延长消息及相关密钥材料的保留期，也不改变原事件的发送设备、接受时间或其他内容。
- 已经接受的相同请求不重新适用 `created_at` 的时钟容错或当前 `epoch` 检查；后续时间推移和密钥轮换不否定原接受结果。并发请求、响应丢失和中继重启不改变上述要求。

群存续期间，中继必须将用于判定请求内容是否相同的信息和原 `sequence` 至少保留至原消息的 `accepted_at` 加接受时的 `group_message_retention`，与消息的最低保留期限一致。后续配置调整和重复请求不得缩短或延长已经确定的最低保留期限。

保留期结束后不再保证原结果可取得；仍返回既有结果时，必须继续遵循上述相同内容和原序号规则。

超时、断线或响应丢失不证明消息未被接受；客户端应向原托管中继原样重试，不能仅因结果不明而换消息 ID 重新发送。

明确拒绝的未接受消息可以按拒绝原因修正后重发；旧密钥版本的重加密必须使用新的消息 ID。
