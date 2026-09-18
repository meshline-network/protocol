# 频道订阅方法

[频道托管协议](../README.md) · [方法公共约定](../../methods/conventions.md)

## `channel.subscribe`

`channel.subscribe` 原子替换当前 WebSocket 连接的频道订阅集合。成功订阅后，连接可以接收对应频道的 [`channel.timeline.changed`](../notifications/README.md#channeltimelinechanged) 通知。

| 项目 | 约定 |
|---|---|
| HTTP | 不支持 |
| 会话要求 | 设备会话 |
| WSS | `channel.subscribe` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `channel_ids` | array&lt;string&gt; | 是 | 本次调用成功后，当前 WebSocket 连接应订阅的完整频道 ID 集合；数组可以为空，表示取消全部频道订阅；ID 不得重复，每个频道必须由当前中继托管，数量须满足下文的订阅上限规则 |

### 响应对象

无。

### 处理与错误

中继先验证请求参数和设备会话。数组包含重复或非法频道 ID，或者不满足下述数量规则时返回 `bad_request`；会话无效时返回 `unauthorized`；会话模式不符合要求时返回 `forbidden`。

数量检查以本次替换生效前、当前连接仍有效的频道订阅集合为基准。请求包含任一尚未订阅的频道时，完整新集合的数量不得超过 `relay.info.limits.max_channel_subscriptions` 的当前值；没有新增频道订阅时，不得仅因数量仍超过当前上限而拒绝。数组顺序不影响集合比较。

任一频道不存在或不由当前中继托管时，返回 `not_found`，并在 [JSON-RPC 错误对象](../../methods/conventions.md#错误响应)的 `data` 中提供：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `channel_ids` | array&lt;string&gt; | 是 | 本次请求中不能订阅的全部频道 ID；非空、不重复，每项均来自请求的 `channel_ids` |

全部频道校验通过后，原子替换当前连接的订阅集合；任何失败均保持原集合。
