# 消息投递方法

[中继 RPC 协议](../README.md) · [方法公共约定](conventions.md) · [消息投递](../../client-relay/concepts/message-delivery.md)

## `message.deliver`

源中继向目标中继投递已经通过 `message.send` 接受的消息。信封的 `to` 为收件账户，必须不同于 `from`；账户自身投递由 `message.send` 直接处理。

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `envelope` | MessageEnvelope | 是 | 客户端提交的完整原信封 |
| `recipient_boxes` | array&lt;MessageKeyBox&gt; | 是 | 客户端提交的完整收件方密钥盒，遵循[收件方消息密钥盒](../../client-relay/core-objects/messages-and-content.md#收件方消息密钥盒)的约束 |
| `signer_certificate` | DeviceCertificate | 是 | 签署信封的设备证书；必须与信封的 `from`、`from_device_id` 一致 |
| `authorization` | [ContactGrant](../../client-relay/concepts/contacts.md#contactgrant) 或 [ContactInvite](../../client-relay/concepts/contacts.md#contactinvite) | 否 | 原发送请求的授权材料；公开引导投递可省略 |

### 成功响应

返回 [`DeliveryStatus`](../../client-relay/concepts/message-delivery.md#deliverystatus)，`status` 为 `target_accepted`。

### 错误响应

未接受收件时，调用失败，不追加收件记录。主要错误如下，其他错误遵循[公共错误约定](../../client-relay/methods/conventions.md#错误码)：

| 情况 | 错误码 |
|---|---|
| 已知有效当前路由指向其他中继 | `route_stale` |
| 无法确认本中继是收件账户的当前归属中继 | `target_not_local` |
| 信封创建时间晚于本地时钟容错范围 | `clock_skew` |
| 已超过本中继的消息递送期限 | `message_expired` |
| 收件设备全部不可用 | `device_unknown` |

源中继按[投递期限与重试](../../client-relay/concepts/message-delivery.md#投递期限与重试)处理错误，决定继续重试或结束投递。

### 处理规则

请求须通过基本参数校验和中继连接认证。已经接受的请求按[消息幂等重试](../../client-relay/concepts/message-delivery.md#消息幂等重试)返回结果；尚未接受的请求须满足[收件校验规则](../../client-relay/concepts/message-delivery.md#收件校验规则)。

接受消息后，原信封和收件方密钥盒进入收件账户时间线，同步响应须能提供对应的发送设备证书。每条消息只追加一条记录，设备可见范围遵循[账户消息时间线](../../client-relay/concepts/message-timeline.md#设备可见范围)。
