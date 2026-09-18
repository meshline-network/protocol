# 账户资料方法

[客户端—中继协议](../README.md) · [方法公共约定](conventions.md) · [账户资料与设备证书](../core-objects/accounts-and-devices.md) · [账户与设备生命周期](../concepts/account-and-device-lifecycle.md)

## `profile.publish`

`profile.publish` 要求当前归属中继保存一份由发布者本次所用设备签署的资料快照，供其他账户读取。

| 项目 | 约定 |
|---|---|
| HTTP | `PUT /meshline/v1/profile/publish` |
| 会话要求 | 设备会话 |
| WSS | `profile.publish` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

请求参数直接使用完整 `AccountProfile`，资料必须属于调用账户。

### 响应对象

无。成功表示中继已经持久化该资料及验证其签名所用的设备证书。

### 处理规则

中继必须通过设备会话确认发布账户和签名设备，并按[账户资料](../core-objects/accounts-and-devices.md#accountprofile)规则验证该文档。

中继必须检查完整资料是否满足 [`AccountProfile`](../core-objects/accounts-and-devices.md#accountprofile) 的 8 KiB Canonical JSON 大小上限。超限时返回 `request_too_large`，不得保存本次资料或替换已保存资料。

中继接受发布前，必须以本地 Unix 秒检查 `updated_at`；超过本地时间加中继允许的未来偏差时返回 `clock_skew`，不得替换已保存资料。时间字段类型或表示非法返回 `bad_request`。

中继按 `updated_at` 比较同一账户资料的新旧：值较大的有效资料替换当前资料，值较小时返回 `stale_state`；值相同时，以中继实际接受更新的先后顺序为准，后接受的有效资料覆盖先前资料。

## `profile.resolve`

`profile.resolve` 按完整账户 ID 读取目标账户资料。不要求目标账户授权或联系人关系。客户端调用仍要求有效设备会话，该会话只用于中继接入和资源控制。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/profile/resolve` |
| 会话要求 | 设备会话 |
| WSS | `profile.resolve` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | 要读取资料的目标[账户 ID](../core-objects/accounts-and-devices.md#账户-id) |

### 响应对象

响应对象返回资料及其签名设备证书：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `profile` | AccountProfile | 是 | 目标账户当前选中的有效资料 |
| `signer_certificate` | DeviceCertificate | 是 | 中继接受发布时验证资料签名所用的设备证书；资料在发布时已经确认签名设备有效，不要求其读取时仍在当前状态中 |

调用方必须按 [`DeviceCertificate`](../core-objects/accounts-and-devices.md#devicecertificate) 的签名与账户绑定规则独立验证 `signer_certificate`，使用其中的设备签名公钥验证资料中的设备签名，并确认 `profile.account` 与原请求的 `account` 相同。

### 处理与错误

缺少账户、显式 `null`、空字符串或格式非法的账户值返回 `bad_request`。

所有调用都要求有效设备会话。会话缺失、过期或失效时返回 `unauthorized`；会话模式不符时返回 `forbidden`。

源中继先验证设备会话，再按目标账户的当前路由处理本地目标，或把包含目标 `account` 的请求作为中继间 `profile.resolve` 的 `params` 转发。

目标中继必须确认自己仍是目标账户的当前归属中继：已知有效当前路由指向其他中继时返回 `route_stale`，无法确定当前归属中继时返回 `target_not_local`。自身与其他账户查询均遵循[目标路由与刷新规则](../../relay-rpc/methods/conventions.md#目标中继选择与路由刷新)，不得以非归属中继的旧资料作为当前权威响应。

目标资料不存在时返回 `not_found`；存在时返回完整资料及其签名设备证书。读取不改变资料或账户状态，也不授予完整设备集合查询或消息投递权限。
