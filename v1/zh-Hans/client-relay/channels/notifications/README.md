# 频道通知

[频道托管协议](../README.md) · [客户端—中继通知](../../notifications/README.md) · [频道订阅方法](../methods/subscription.md)

## `channel.timeline.changed`

`channel.timeline.changed` 是频道时间线追加事件后，中继向订阅连接发送的通知。

连接必须具有有效设备会话并已通过 `channel.subscribe` 订阅对应频道。

通知发送遵循[原子提交与持久化规则](../concepts/model-and-timeline.md#原子提交与持久化规则)要求。

### 通知参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `channel_id` | string | 是 | 已通过当前连接的 `channel.subscribe` 订阅且时间线发生变化的频道 |
| `head` | integer | 是 | 发送通知时中继已经提交的最新频道时间线 sequence |

### 处理规则

客户端按[通知处理规则](../../notifications/README.md#通知处理规则)处理提示，需要读取事件时调用 [`channel.read`](../methods/timeline.md#channelread)。

重新订阅、通知丢失或没有 WSS 连接时，客户端仍可通过 `channel.read` 读取保留范围内的事件。

频道时间线事件按[频道保留规则](../concepts/model-and-timeline.md#频道时间线生命周期)保存和清理。客户端不得把通知或已保存 sequence 当作内容仍存在的证明。
