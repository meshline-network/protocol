# 账户查询方法

[中继 RPC 协议](../README.md) · [方法公共约定](conventions.md)

## `device.status`

`device.status` 向账户当前归属中继查询指定设备的当前授权状态，主要用于其他中继建立设备会话前的授权检查。已经由源中继设备会话授权的业务请求，不为同一次操作重复调用本方法。

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | [账户 ID](../../client-relay/core-objects/accounts-and-devices.md#账户-id)；也是本次调用的目标账户 |
| `device_id` | string | 是 | 从目标设备的 `DeviceCertificate` 派生的[设备 ID](../../client-relay/core-objects/accounts-and-devices.md#设备-id) |

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `status` | string | 是 | 设备在该账户当前权威状态中的证书授权结果；`active` 表示设备证书当前有效，`inactive` 表示设备当前没有有效授权 |
| `expires_at` | integer | 条件 | `status` 为 `active` 时必须出现，等于当前状态中该设备最新证书的到期 Unix 秒；`status` 为 `inactive` 时必须省略 |

### 处理与缓存规则

目标中继只能根据本地保存的当前 `AccountDeviceState` 回答查询；其他中继的缓存不得作为权威结果。只有当前状态存在与设备 ID 匹配、双重签名有效且当前时间位于证书有效期的最新证书时，才返回 `active`；其他情况统一返回 `inactive`，不区分从未存在、已移除、尚未生效或已经到期。

调用方必须确认认证对端是该账户的当前归属中继，并按[响应关联规则](conventions.md#请求)将结果与原请求关联。

调用中继可以按本地有限缓存策略使用已验证结果；缓存必须保持请求账户、设备与认证对端的绑定，不能作为其他账户、设备或归属中继的查询结果。缓存超过该有限窗口时必须失效；`active` 结果的缓存到达其 `expires_at` 时也必须失效。一旦获知更新状态，必须停止使用旧缓存。

调用方可以用同一设备 ID 的旧证书验证历史或在途对象中的设备公钥绑定和签名；当前权限只取决于该设备 ID 在最新权威状态中是否仍是有效设备，不要求旧证书与最新证书的完整内容相同。

## `device.state.resolve`

`device.state.resolve` 用于取得目标账户当前完整设备状态，供调用方选择当前有效的接收设备并生成密钥盒。

### 请求参数

本方法接受两种请求参数：

- 公开查询：`params` 必须显式包含目标 `account`，字段定义见客户端—中继 `device.state.resolve` 的[按账户读取](../../client-relay/methods/device-state.md#按账户读取)；不携带请求证书、请求签名或访问凭据。
- 签名查询：使用客户端—中继 `device.state.resolve` 的[完整签名请求](../../client-relay/methods/device-state.md#签名查询)，其中 `account` 指定目标账户；源中继不得重建、删减或改写字段。

查询形式的识别与完整性校验遵循客户端—中继 `device.state.resolve` 的[WebSocket 查询规则](../../client-relay/methods/device-state.md#签名查询)。自身读取只在客户端与归属中继之间使用，不适用于本方法。

### 响应对象

响应对象及调用方验证要求均遵循客户端—中继 [`device.state.resolve`](../../client-relay/methods/device-state.md#devicestateresolve) 的响应规则。

### 处理与错误

源中继接受客户端请求时，必须确认设备会话仍然有效。

#### 公开查询

公开查询的目标中继必须确认当前资料已开启公开发现，否则返回 `forbidden`。目标中继不验证客户端会话，也不查询请求设备状态。仅携带账户 ID 的中继间请求始终按公开查询授权，不适用客户端通过归属中继设备会话获得的自身读取权限。

#### 签名查询

签名查询时，源中继还必须确认请求证书对应本次调用设备及调用账户，并验证请求证书和请求签名。该检查是本次读取对请求设备的授权判定；设备状态在此后发生变化，不追溯已经接受的本次请求。目标中继必须重新验证签名设备证书、请求签名和账户绑定。请求签名使用该证书的 `signing_public_key` 验证。目标中继不重复查询或判定请求设备的当前状态。

签名查询时，目标中继按客户端—中继 [`device.state.resolve`](../../client-relay/methods/device-state.md#devicestateresolve) 的规定验证访问凭据。

#### 错误与路由处理

业务校验和 `created_at` 新鲜度检查的错误，遵循客户端—中继 [`device.state.resolve`](../../client-relay/methods/device-state.md#devicestateresolve) 的处理规则；源中继按客户端所用传输方式的错误映射规则，将目标中继的错误返回给客户端。账户路由变化遵循[账户路由规则](conventions.md#目标中继选择与路由刷新)，其他错误遵循[错误响应规则](conventions.md#错误响应)。

## `profile.resolve`

`profile.resolve` 用于取得指定账户当前有效的 `AccountProfile`。

### 请求参数

请求参数是客户端—中继 [`profile.resolve`](../../client-relay/methods/profiles.md#profileresolve) 的完整请求参数，其中 `account` 指定目标账户。

### 响应对象

响应对象及调用方验证要求均遵循客户端—中继 [`profile.resolve`](../../client-relay/methods/profiles.md#profileresolve) 的响应规则。

### 处理与错误

源中继接受客户端请求时，必须确认设备会话仍然有效。目标中继不验证客户端会话、不查询请求设备状态，也不验证联系人授权。

目标归属校验、参数错误、资料不存在和响应验证均遵循客户端—中继 [`profile.resolve`](../../client-relay/methods/profiles.md#profileresolve) 的处理规则；源中继按客户端所用传输方式的错误映射规则，将目标中继的错误返回给客户端。账户路由变化遵循[账户路由规则](conventions.md#目标中继选择与路由刷新)，其他错误遵循[错误响应规则](conventions.md#错误响应)。
