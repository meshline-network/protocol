# 中继 RPC 通知

[中继 RPC 协议](../README.md) · [方法公共约定](../methods/conventions.md)

## `device.status.changed`

账户当前归属中继可以向近期查询过本账户设备证书状态的其他中继发送 `device.status.changed`。

### 通知参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | 设备状态发生变化的账户 |
| `device_id` | string | 是 | 缓存应失效的设备 ID |

### 处理规则

接收方必须确认发送方是该账户当前路由指定的中继，否则拒绝通知。

通过校验后，接收方必须使对应 `(account, device_id)` 的证书状态缓存失效，并按需重新调用 [`device.status`](../methods/account-queries.md#devicestatus)。只有按该方法验证重新查询所得的 `inactive` 结果后，才能据此使本地会话失效。

缓存已失效且尚待核验时，可以合并重复提示；缓存重新填充后，相同参数的提示仍须使其失效。查询期间收到未确认被该查询覆盖的新提示时，不得用该查询响应恢复可用缓存，应按需补查；不得使用失效缓存授权。
