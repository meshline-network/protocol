# 账户路由方法

[客户端—中继协议](../README.md) · [账户与设备生命周期](../concepts/account-and-device-lifecycle.md)

## `account.route.publish`

`account.route.publish` 要求当前连接中继完成并发布一份账户签名路由。调用方必须先通过账户会话证明自己控制路由所标明的账户。

| 项目 | 约定 |
|---|---|
| HTTP | `PUT /meshline/v1/account/route/publish` |
| 会话要求 | 账户会话 |
| WSS | `account.route.publish` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

请求参数直接使用待发布的完整 [`AccountRoute`](../../relay-dht/core-objects.md#accountroute)。

账户会话所认证的账户必须与路由文档所属账户相同。路由必须指定由当前连接中继负责该账户，必须包含有效 `account_signature`，并省略 `relay_signature`。

### 响应对象

成功响应是追加中继签名后的 `AccountRoute`。成功表示当前连接中继已成为该账户的当前归属中继、已经持久化最终路由、完成 DHT PUT 且达到自身的副本确认策略。

客户端必须确认响应只是对所提交文档追加中继签名，并按 [AccountRoute 的验证规则](../../relay-dht/core-objects.md#验证规则)验证最终文档；验证通过后，保存最终文档和 `revision`。

### 处理规则

中继必须确认本地仍保存该账户的有效权威状态或尚未到期的当前预存设备状态。缺少可用状态时必须返回 `state_conflict`，不得签署或发布路由。

请求版本低于中继按[路由版本与冲突解决](../../relay-dht/core-objects.md#路由版本与冲突解决)保存的最高版本时，返回 `stale_state`。其他情况下，请求与已知同版本路由内容不同，或未使用高于已知冲突版本的 `revision` 解决冲突时，返回 `state_conflict`。上述情况均不得签署或发布该请求。

中继接受发布前必须按 [AccountRoute 验证规则](../../relay-dht/core-objects.md#验证规则)检查 `updated_at`；超过本地 Unix 秒加中继允许的未来偏差时，返回 `clock_skew`，不得签署或发布该请求，也不得改变已保存的路由、最高版本或冲突状态。时间字段类型或表示非法仍返回 `bad_request`。

接受发布还要求最终共同签名文档的完整 Canonical JSON UTF-8 编码不超过 4 KiB（4,096 bytes），包括待追加的 `relay_signature`、已有账户签名和全部未知属性。最终文档超限时返回 `request_too_large`，不得发布或改变已保存的路由、最高版本和冲突状态；不能只校验客户端提交的草稿大小。请求和响应各自仍须满足传输消息大小限制。

检查通过后，中继不得修改请求已有字段，只能追加 `relay_signature`，再持久化最终文档并发布到 DHT。后续副本维护遵循[重新发布与持久化](../../relay-dht/concepts/account-route-lifecycle.md#重新发布与持久化)。

## `account.route.resolve`

`account.route.resolve` 允许任何请求者按完整账户 ID 查询该账户当前的公开路由。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/account/route/resolve` |
| 会话要求 | 无需 |
| WSS | `account.route.resolve` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | 要查询的[账户 ID](../core-objects/accounts-and-devices.md#账户-id) |

### 响应对象

成功响应是从 DHT 收集、验证并按[路由版本与冲突解决](../../relay-dht/core-objects.md#路由版本与冲突解决)选中的 `AccountRoute`；客户端和中继仍须独立验证。使用已保存路由时，遵循 [`AccountRoute` 验证规则](../../relay-dht/core-objects.md#验证规则)。

### 处理与错误

存在尚未被更高版本替换的同版本路由冲突时返回 `invalid_state`；没有满足中继持久化版本下界的有效记录且不存在此类未解决冲突时返回 `not_found`，包括较新路由已经过期而只能查到较低版本旧路由的情况。
