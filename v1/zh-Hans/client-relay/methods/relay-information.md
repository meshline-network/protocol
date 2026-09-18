# 中继发现与信息方法

[客户端—中继协议](../README.md) · [发现与会话概念](../concepts/discovery-and-sessions.md)

## `relay.descriptor`

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/relay/descriptor` |
| 会话要求 | 无需 |
| WSS | `relay.descriptor` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

无。

### 响应对象

成功结果是当前中继签署的 [`RelayDescriptor`](../core-objects/relay-descriptor.md#relaydescriptor)。发现入口、业务地址选择和中继连接认证遵循[中继发现](../concepts/discovery-and-sessions.md#中继发现)规则。

## `relay.info`

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/relay/info` |
| 会话要求 | 无需 |
| WSS | `relay.info` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

无。

### 响应对象

| 字段 | 类型 | 必需 | 语义 |
|---|---|---|---|
| `relay_id` | string | 是 | Registry 记录中的[中继 ID](../../registry/core-objects.md#中继-id) |
| `name` | string | 是 | 面向用户的中继显示名称，非身份标识；必须至少包含一个非[空白字符](../../general.md#文本空白字符)，最多 256 UTF-8 bytes |
| `server_time` | integer | 是 | 中继当前 Unix 秒 |
| `limits` | object | 是 | 当前中继公开的服务限制和保留策略；每次请求还适用[安全与资源控制](conventions.md#资源与安全控制)的动态资源与速率限制 |

调用方必须确认响应中的 `relay_id` 与本次连接所依据的已验证 `RelayDescriptor` 中的 `relay_id` 相同。

`limits` 字段：

| 字段 | 类型 | 必需 | 语义 |
|---|---|---|---|
| `message_retention` | integer | 是 | 账户消息时间线完整记录的最短保留期（秒），必须为正整数；保留规则见[消息保留与历史缺口](../concepts/message-timeline.md#消息保留与历史缺口) |
| `channel_timeline_retention` | integer | 条件 | 中继提供频道托管服务时必须出现，否则可以省略；频道时间线事件的最短保留期（秒），必须为正整数；每项事件按接受时的值确定最低保留截止时间，后续调低不使既有事件提前到期 |
| `max_channel_subscriptions` | integer | 条件 | 中继提供频道托管服务且存在 WSS endpoint 时必须出现，否则可以省略。表示 `channel.subscribe` 新增订阅时，订阅集合允许的最大不同频道 ID 数；出现时必须为非负整数，`0` 表示暂停新增订阅，已有订阅仍可保留、减少或清空 |
| `group_message_retention` | integer | 条件 | 中继提供群组托管服务时必须出现，否则可以省略；群消息事件的最短保留期（秒），必须为正整数 |
| `max_group_members` | integer | 条件 | 中继提供群组托管服务时必须出现，否则可以省略；新建群和群扩容允许的成员容量上限，必须为正整数；以后降低不使既有成员或容量失效 |
| `max_group_subscriptions` | integer | 条件 | 中继提供群组托管服务且存在 WSS endpoint 时必须出现，否则可以省略。表示 `group.subscribe` 新增订阅时，订阅集合允许的最大不同群 ID 数；出现时必须为非负整数，`0` 表示暂停新增订阅，已有订阅仍可保留、减少或清空 |
| `max_group_invite_ttl` | integer | 条件 | 中继提供群组托管服务时必须出现，否则可以省略；客户端创建的新邀请允许的最长有效期（秒），必须为正整数 |
