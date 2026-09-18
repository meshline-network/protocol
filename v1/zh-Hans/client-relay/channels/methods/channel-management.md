# 频道管理方法

[频道托管协议](../README.md) · [方法公共约定](../../methods/conventions.md) · [业务模型](../concepts/model-and-timeline.md)

## 频道描述写入规则

创建、更新和关闭时，托管中继使用已认证设备会话对应的设备证书，确认该证书的 `account`、调用账户与目标描述的 `creator` 相同，且证书标识本次调用设备，再按 [`ChannelDescriptor`](../core-objects.md#channeldescriptor) 的定义验证目标描述；接受后在描述事件外层记录 `signer_device_id`，并按[频道事件的设备证书](../core-objects.md#频道事件的设备证书)规则保存证书与描述的对应关系。

创建、更新和关闭遵循[原子提交与持久化规则](../concepts/model-and-timeline.md#原子提交与持久化规则)要求。

## `channel.create`

`channel.create` 向所连接中继提交初始 revision 的完整签名频道描述，请求该中继接受并托管它。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/channel/create` |
| 会话要求 | 设备会话 |
| WSS | `channel.create` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

请求参数直接使用客户端签署的完整 [`ChannelDescriptor`](../core-objects.md#channeldescriptor)。

创建者必须按[频道 ID](../core-objects.md#频道-id)规则，为每个新频道生成新的 `nonce` 并派生 `channel_id`。`creator` 必须等于设备会话账户，签署设备由该会话确定，`relay_id` 必须是当前连接中继。

初始 `revision` 必须为 0，`status` 必须为 `active`，`created_at` 与 `updated_at` 必须相同，均为客户端签署初始描述的 Unix 秒。

### 响应对象

无。需要取得创建事件及其 `accepted_at` 时调用 [`channel.read`](timeline.md#channelread)。

### 处理与错误

中继通过设备会话确认调用账户和调用设备，使用会话对应的设备证书验证完整描述签名，并核对频道 ID 派生关系、托管中继及上述初始状态约束。缺少必需字段、字段格式非法、携带仅用于签名输入的网络字段，或不满足频道 ID、托管中继、初始 revision、状态及时间相等约束时返回 `bad_request`；会话和权限错误遵循[公共错误规则](../../methods/conventions.md#错误码)，证书或描述签名无效时返回 `invalid_signature`。

中继必须检查本次提交的完整描述是否满足 [`ChannelDescriptor`](../core-objects.md#channeldescriptor) 的大小上限。超限返回 `request_too_large`，不得创建频道或写入时间线。

派生的 `channel_id` 是频道资源身份。中继已经托管该频道时，`channel.create` 返回 `state_conflict`。

中继以本地 Unix 秒判断 `created_at` 是否处于自己的时钟容错范围内。时间过旧或超前超过允许范围时返回 `clock_skew`，不得创建频道或写入时间线。

验证成功后，中继把完整请求对象作为 sequence 0 的创建事件写入新频道时间线，记录事件的 `descriptor_rev` 为 0，并固化该条目的 `accepted_at`。建立频道托管状态、保存当前描述和写入创建事件必须原子完成。

频道创建遵循[资源与安全控制](../../methods/conventions.md#资源与安全控制)规则。

## `channel.resolve`

`channel.resolve` 按频道 ID 查询当前或指定 revision 的频道描述。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/channel/resolve` |
| 会话要求 | 设备会话 |
| WSS | `channel.resolve` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `channel_id` | string | 是 | 按[频道 ID](../core-objects.md#频道-id)规则派生的频道 ID |
| `revision` | integer | 否 | 要取得的频道描述的确切版本，必须为非负安全整数；省略表示当前 revision |

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `descriptor` | ChannelDescriptor | 是 | 对应 revision 的完整[频道描述](../core-objects.md#channeldescriptor) |
| `signer_certificate` | DeviceCertificate | 是 | 签署该 revision 的设备证书 |

客户端必须确认 `descriptor` 中的频道 ID 和指定 revision 与请求相符，验证 `signer_certificate` 的签名及身份绑定，并使用该证书验证描述。描述验证和本地状态更新遵循 [`ChannelDescriptor`](../core-objects.md#channeldescriptor) 的规则。

### 处理与错误

`revision` 出现但不满足非负安全整数要求时，返回 `bad_request`。频道或指定 revision 不存在，或者指定的历史描述已经按保留规则清理时，返回 `not_found`。频道处于 `active` 状态期间，当前描述以及按保留和依赖规则要求的历史描述必须可解析；具体规则见[频道时间线生命周期](../concepts/model-and-timeline.md#频道时间线生命周期)。

## `channel.update`

`channel.update` 向频道托管中继提交下一 revision 的完整签名频道描述。

| 项目 | 约定 |
|---|---|
| HTTP | `PUT /meshline/v1/channel/update` |
| 会话要求 | 设备会话 |
| WSS | `channel.update` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

请求参数直接使用客户端签署的完整 [`ChannelDescriptor`](../core-objects.md#channeldescriptor)。

`channel_id` 标识待更新频道。目标描述的 `channel_id`、`nonce`、`creator`、`relay_id` 和 `created_at` 必须与当前描述相同，`status` 必须仍为 `active`；设备会话账户必须仍为频道创建者，并由本次调用的有效设备签署。

`revision` 必须为正整数并恰好等于中继当前 revision 加 1，`updated_at` 使用客户端签署本次更新的 Unix 秒。

可选字段省略表示新描述不包含该字段，不从旧描述补齐。

### 响应对象

无。

### 处理与错误

中继通过设备会话确认调用账户、调用设备及频道 owner 权限，使用会话对应的设备证书验证完整描述签名，并核对频道 ID 派生关系及上述状态约束。缺少必需字段、字段格式非法、携带仅用于签名输入的网络字段、试图改变不可变字段，或请求的 `status` 不为 `active` 时返回 `bad_request`；会话和权限错误遵循[公共错误规则](../../methods/conventions.md#错误码)，证书或描述签名无效时返回 `invalid_signature`。当前描述已经为 `closed` 时，新的更新返回 `state_conflict`。

中继检查本次提交的完整描述是否满足 [`ChannelDescriptor`](../core-objects.md#channeldescriptor) 的大小上限；超限返回 `request_too_large`。中继以本地 Unix 秒判断 `updated_at` 是否处于自己的时钟容错范围内；时间过旧或超前超过允许范围时返回 `clock_skew`。

同一频道的一个 revision 只能对应一项描述事件。目标 revision 已经被占用，或不是当前 revision 的下一项时返回 `state_conflict`。

更新生效时，当前 revision 和状态必须仍满足请求的前置条件。把经过验证的完整请求对象作为描述事件追加到时间线、固化该条目的 `accepted_at`、推进 sequence，以及保存它作为当前描述，必须原子生效。保存的描述和事件 `payload` 必须与收到的签名对象逐字段相同；任何校验或提交失败均不得改变频道状态或时间线。

## `channel.close`

`channel.close` 永久关闭频道。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/channel/close` |
| 会话要求 | 设备会话 |
| WSS | `channel.close` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `channel_id` | string | 是 | 待关闭频道 |
| `revision` | integer | 是 | 客户端签署的最终频道描述版本；必须恰好等于中继当前 revision 加 1 |
| `updated_at` | integer | 是 | 最终频道描述的 `updated_at`；语义遵循 [`ChannelDescriptor`](../core-objects.md#channeldescriptor) 的同名字段定义 |
| `device_signature` | string | 是 | owner 账户的设备对最终 `ChannelDescriptor` 生成的 64-byte Ed25519 签名，无 padding base64url |

1. 复制当前 `ChannelDescriptor`，将 `status` 改为 `closed`，写入请求的 `revision` 和 `updated_at`。
2. 移除根字段 `device_signature`；其余属性原样保留。
3. 按 [`ChannelDescriptor`](../core-objects.md#channeldescriptor) 的签名规则生成签名，再将签名写入关闭请求。

### 响应对象

无。

### 处理与错误

频道已经关闭或目标 revision 已经被占用时返回 `state_conflict`。

接受关闭请求时，当前描述必须为 `active`，目标 revision 必须是当前 revision 的下一项，请求设备必须是 owner 账户用于本次调用的有效设备。中继必须通过设备会话确认调用账户和调用设备，按自己的时钟容错策略验证 `updated_at`，按上述构造规则重建最终描述并验证 `device_signature`；时间过旧或超前超过允许范围时返回 `clock_skew`。验证失败不得改变频道状态或写入时间线。

中继必须检查重建后的完整最终描述是否满足 [`ChannelDescriptor`](../core-objects.md#channeldescriptor) 的大小上限，包括沿用当前描述的属性。超限返回 `request_too_large`，不得改变频道状态或写入时间线。

把最终 `ChannelDescriptor` 追加到时间线、固化该条目的 `accepted_at`、推进 sequence、保存它作为当前描述以及关闭频道，必须原子生效；任一部分失败都不得改变频道状态或时间线。
