# 消息方法

[客户端—中继协议](../README.md) · [方法公共约定](conventions.md) · [消息与内容](../core-objects/messages-and-content.md) · [消息投递](../concepts/message-delivery.md) · [账户消息时间线](../concepts/message-timeline.md) · [归属中继变更](../concepts/account-and-device-lifecycle.md#归属中继变更)

## `message.send`

向发送账户的当前归属中继提交一条已加密和签名的消息，由该中继承担投递责任。消息面向单一目标账户。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/message/send` |
| 会话要求 | 设备会话 |
| WSS | `message.send` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `envelope` | MessageEnvelope | 是 | [加密消息信封](../core-objects/messages-and-content.md#messageenvelope)；`from`、`from_device_id` 必须分别与设备会话的账户和设备一致 |
| `recipient_boxes` | array&lt;MessageKeyBox&gt; | 是 | 为收件账户设备封装消息内容密钥，遵循[收件方消息密钥盒](../core-objects/messages-and-content.md#收件方消息密钥盒)的约束 |
| `sender_boxes` | array&lt;MessageKeyBox&gt; | 否 | 非自身投递可选，省略时不建立发件侧时间线记录；自身投递必须省略。为发送账户设备封装同一内容密钥，遵循[发送方消息密钥盒](../core-objects/messages-and-content.md#发送方消息密钥盒)的约束 |
| `authorization` | [ContactGrant](../concepts/contacts.md#contactgrant) 或 [ContactInvite](../concepts/contacts.md#contactinvite) | 否 | 收件账户授予发送账户的 `ContactGrant`，或收件账户签发的 `ContactInvite`；自身投递省略，公开引导投递可省略 |

公开引导投递和凭据授权的收件条件见[消息投递](../concepts/message-delivery.md#收件校验规则)。

### 成功响应

返回 [`DeliveryStatus`](../concepts/message-delivery.md#deliverystatus)，表示中继已经接受请求。`status` 返回当前已知的投递状态；接受后投递失败时，仍返回成功响应，结果中的 `status` 为 `failed`。

### 错误响应

中继未接受请求时，调用失败，不产生发件记录或投递责任。主要错误如下，其他错误遵循[方法公共约定](conventions.md#错误码)：

| 情况 | 错误码 |
|---|---|
| 已知有效当前路由指向其他中继 | `route_stale` |
| 无法确认本中继是发送账户的当前归属中继 | `target_not_local` |
| 信封创建时间晚于本地时钟容错范围 | `clock_skew` |
| 已超过本中继的消息递送期限 | `message_expired` |
| 提供了发送方密钥盒但其中的设备全部不可用，或在接受前发现收件设备全部不可用 | `device_unknown` |

### 处理规则

每次调用均须通过设备会话认证，并确认本中继是发送账户当前有效路由指定的归属中继。本方法不由其他中继代为转交。重复请求适用[消息幂等重试](../concepts/message-delivery.md#消息幂等重试)。

接受新请求前，中继须验证原信封的设备签名、信封及密钥盒的对象约束、授权材料和大小限制，并按本中继的时钟容错与消息递送期限验证 `created_at`。

接受后的发件记录、收件验证及后续投递遵循[投递流程](../concepts/message-delivery.md#投递流程)。账户自身投递须在本次调用中完成收件验证并接受消息。

## `message.delivery.status`

查询调用账户通过 `message.send` 提交消息的投递状态，账户由设备会话确定。请求发往接受原发送请求的中继。查询不触发投递或重试。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/message/delivery/status` |
| 会话要求 | 设备会话 |
| WSS | `message.delivery.status` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `message_id` | string | 是 | 要查询的消息 ID；只在会话账户范围内查询 |

### 成功响应

返回 [`DeliveryStatus`](../concepts/message-delivery.md#deliverystatus)，`status` 为最新已知投递状态。

### 错误响应

除[投递结果保留规则](../concepts/message-delivery.md#投递结果保留规则)允许返回 `message_expired` 的情况外，查不到该消息的投递结果时返回 `not_found`。其他错误遵循[方法公共约定](conventions.md#错误码)。

## `message.timeline.sync`

按 sequence 读取当前连接中继本地、当前设备可见的账户消息时间线，账户和设备均由设备会话确定。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/message/timeline/sync` |
| 会话要求 | 设备会话 |
| WSS | `message.timeline.sync` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `after` | integer | 否 | 只返回此位置之后的可见条目；值必须为 `-1` 或非负安全整数，且不得超过本次读取时该账户在当前中继的[时间线头](../concepts/message-timeline.md#账户消息时间线)，越界时返回 `bad_request`。省略时为 `-1`，表示从本中继仍保留的最早设备可见记录开始读取 |
| `limit` | integer | 否 | 本页最多返回的条目数；必须为正安全整数，遵循[分页约定](conventions.md#分页) |

`after` 在有效范围内时，不要求对应已分配、仍保留或当前设备可见的记录；等于时间线头时返回空页。

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `items` | array&lt;[MessageTimelineEntry](../concepts/message-timeline.md#messagetimelineentry)&gt; | 是 | 当前设备可见且 sequence 大于本次读取位置的最早一页条目，按 sequence 升序；没有条目时为空数组 |
| `certificates` | array&lt;DeviceCertificate&gt; | 是 | 本页条目引用的发送设备证书；按派生设备 ID 去重 |
| `has_more` | boolean | 是 | 当前查询时是否还有本页未返回的可见条目；空页时必须为 `false` |
| `has_retention_gap` | boolean | 否 | 本次读取位置之后是否至少有一条原本对当前设备可见的记录已经过期；有历史缺口时必须返回 `true`，没有历史缺口时可以省略或返回 `false` |

客户端必须验证每份证书并派生设备 ID，并确认：

- 派生结果不得重复。
- 所得 ID 集合必须覆盖本页引用集合。
- 证书账户必须是引用它的每条记录的发送账户。

同一设备存在多个证书版本时，中继返回一份签名有效的证书；客户端使用其中稳定的设备公钥验证历史消息，不以证书当前是否仍在有效期内追溯判断中继接受消息时的授权。`certificates` 数组顺序没有协议语义。

### 处理规则

中继从 sequence 大于 `after`、当前设备可见且仍在保留的条目中选择最早一页，按升序返回。未分配、不可见或已清理的位置直接跳过，不占用页面条目；不得跳过仍符合读取条件的条目。存在符合条件的条目时不得返回空页。

`has_retention_gap` 按[消息保留与历史缺口](../concepts/message-timeline.md#消息保留与历史缺口)判定；从相同位置重复请求可以再次返回 `true`。即使存在历史缺口，中继仍正常返回保留范围内的可读条目。

下一次请求的 `after` 使用按[消息时间线处理流程](../concepts/message-timeline.md#消息时间线处理流程)确定的同步位置。
