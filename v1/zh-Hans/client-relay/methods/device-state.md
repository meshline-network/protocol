# 设备状态方法

[客户端—中继协议](../README.md) · [方法公共约定](conventions.md) · [账户资料与设备证书](../core-objects/accounts-and-devices.md) · [账户与设备生命周期](../concepts/account-and-device-lifecycle.md)

## `device.state.publish`

`device.state.publish` 向中继提交完整的 [`AccountDeviceState`](../core-objects/accounts-and-devices.md#accountdevicestate)。

| 项目 | 约定 |
|---|---|
| HTTP | `PUT /meshline/v1/device/state/publish` |
| 会话要求 | 设备会话或账户会话 |
| WSS | `device.state.publish` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

请求参数直接使用完整 `AccountDeviceState`，状态必须属于调用账户。

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `status` | string | 是 | 中继对本次设备状态发布的处理结果：当前归属中继成功接受时为 `accepted`，非归属中继预存时为 `staged` |
| `staged_until` | integer | 条件 | `status` 为 `staged` 时必须出现，表示该预存状态的保留截止时间（Unix 秒）；为 `accepted` 时必须省略 |

### 处理规则

#### 权威状态更新

当前归属中继按 [`AccountDeviceState`](../core-objects/accounts-and-devices.md#accountdevicestate) 的规则验证完整设备状态。没有该账户的设备状态时，接受通过验证的完整状态；已有状态时，版本更高的有效状态替换当前状态，版本更低时返回 `stale_state`。版本相同但完整内容不同时返回 `state_conflict`，不得覆盖当前状态。完整内容是否相同以 [Canonical JSON](../../general.md#canonical-json) 表示为准。

本次接受新的权威状态时，中继按[会话规则](authentication-and-sessions.md#会话有效性与连接绑定)处理设备会话，并向仍有效的设备发送 `device.state.changed` 通知；`staged` 不改变任何当前权限，也不发送该通知。

#### 预存状态处理

非归属中继可以拒绝预存；若选择预存，不得把它用于设备认证或公开设备查询，直到有效路由把本中继指定为当前归属中继。中继已经保存同一账户的预存状态时，按相同的版本比较规则处理。

版本更高的有效预存状态覆盖原状态，并从本次接受时间重新计算 `staged_until`；中继只需把当前预存状态保留到其返回的截止时间。保留期限到达后，中继可以删除该状态。

#### 重复提交

同一版本、相同完整内容的重复提交通过本方法校验后，不建立新版本，并返回最新处理结果：仍在预存保留期内时返回 `staged` 和原 `staged_until`；已被当前归属中继接受为权威状态时返回 `accepted`，省略 `staged_until`。已经接受的同一状态不重复发送 `device.state.changed` 通知。

## `device.state.resolve`

`device.state.resolve` 读取目标账户的完整 `AccountDeviceState`，支持自身读取、公开查询和凭据授权的签名查询。自身读取允许设备会话或账户会话，读取其他账户必须使用设备会话。

客户端应缓存完整状态；建议在重新上线时读取自身设备状态，收到 [`device.state.changed`](../notifications/README.md#devicestatechanged) 通知后按该通知的规则处理。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/device/state/resolve`<br>`POST /meshline/v1/device/state/resolve` |
| 会话要求 | 设备会话或账户会话 |
| WSS | `device.state.resolve` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

#### 按账户读取

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | 要读取设备集合的目标[账户 ID](../core-objects/accounts-and-devices.md#账户-id) |

缺少账户、显式 `null`、空字符串或格式非法的账户值返回 `bad_request`。GET 不接受签名查询专用字段；出现这些字段时返回 `bad_request`，不得忽略后执行公开查询。

目标是调用账户时，由设备会话或账户会话授权，只向账户当前归属中继读取。目标是其他账户时，必须使用设备会话，按公开查询处理，可以经当前连接中继转发至目标账户的归属中继；目标账户必须已开启公开发现。这种调用不携带请求证书、请求签名或访问凭据。

#### 签名查询

签名查询要求设备会话，请求由调用设备签名，并携带联系人授权或邀请凭据，读取其他账户的设备集合。跨中继读取时，同一完整请求作为中继间 `device.state.resolve` 的 `params`。

HTTP POST 必须提交完整签名查询参数。WebSocket 请求没有签名查询专用字段时执行按账户读取；出现 `$type`、`authorization`、`signer_certificate`、`created_at` 或 `device_signature` 中任一字段时，必须按签名查询验证完整请求。签名查询缺少参数对象、必需账户字段或其他必需字段时返回 `bad_request`，不得因字段缺失、签名或凭据无效而改按自身读取或公开查询处理。

签名输入遵循[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)规则。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.device.state.resolve` |
| `account` | string | 是 | 目标[账户 ID](../core-objects/accounts-and-devices.md#账户-id) |
| `authorization` | [ContactGrant](../concepts/contacts.md#contactgrant) 或 [ContactInvite](../concepts/contacts.md#contactinvite) | 是 | 目标账户授予请求账户的有效 `ContactGrant`，或由目标账户当前有效设备签署的有效 `ContactInvite` |
| `signer_certificate` | DeviceCertificate | 是 | 签署本请求的设备证书；当前连接中继必须确认该证书标识本次调用设备，目标中继必须按 [`DeviceCertificate`](../core-objects/accounts-and-devices.md#devicecertificate) 规则验证设备证书 |
| `created_at` | integer | 是 | 请求设备创建本次请求的 Unix 秒；中继可以按本地新鲜度策略决定是否接受 |
| `device_signature` | string | 是 | `signer_certificate` 对应设备对当前请求参数（排除本字段）生成的 64-byte Ed25519 签名，无 padding base64url |

### 响应对象

各调用方式的成功响应都是所请求账户当前完整的 [`AccountDeviceState`](../core-objects/accounts-and-devices.md#accountdevicestate)。调用方必须按对象定义验证完整状态，并确认其 `account` 与原请求的 `account` 相同。

客户端和转发中继均须按同一可信网络上下文、同一目标账户的已验证设备状态执行上述检查，不因查询授权方式或返回中继不同而独立判断版本。返回状态的 `revision` 较低时拒绝；版本相同时，只有完整状态的 Canonical JSON 相同才可接受；版本较高且通过对象及签名验证时更新已知状态。未通过验证的状态不得改变已知版本，遭拒绝的响应不得用于选择设备或作为有效成功响应转交。

使用邀请查询时，调用方还必须从返回状态中找到当前有效的邀请签署设备，验证同一 `ContactInvite` 的目标账户、签名和有效期。

需要发送消息时，调用方再从已验证的完整状态中选择当前时间满足证书有效期的设备。

### 处理与错误

所有调用都要求有效会话。会话缺失、过期或失效时返回 `unauthorized`；账户会话用于读取其他账户或发起签名查询时返回 `forbidden`。

完成相应授权后，目标账户尚未建立设备状态时返回 `not_found`。已经存在但设备数组为空的状态仍作为完整 `AccountDeviceState` 成功返回。读取不改变账户设备状态。

#### 自身读取

读取自身设备集合时，中继通过设备会话或账户会话确认目标是调用账户，并确认自己仍负责该账户：已知有效当前路由指向其他中继时返回 `route_stale`，无法确定当前归属中继时返回 `target_not_local`。自身读取只向归属中继发起，不要求开启公开发现，也不转发到其他中继。已被移除的设备不能用旧设备会话读取新状态；持有账户密钥者可以建立[账户会话](../concepts/discovery-and-sessions.md#会话模式)后读取自身状态，以便加入新设备或恢复账户设备状态。

#### 公开查询

公开查询其他账户设备集合时，源中继先验证设备会话，再处理本地目标，或把包含目标账户的请求作为中继间 `device.state.resolve` 的 `params` 转发。目标归属中继必须确认当前资料已开启公开发现，否则返回 `forbidden`。跨中继公开查询不携带请求设备证书或请求签名，目标中继不验证客户端会话，也不查询请求设备状态；它只按公开访问条件提供设备状态，不将这种请求视为账户自身授权。

#### 签名查询

签名查询时，当前连接中继必须确认 `signer_certificate` 标识本次调用设备，并验证请求证书、请求签名和账户绑定；该检查是本次读取对请求设备的授权判定。跨中继调用时，目标中继重新验证请求证书、请求签名、账户绑定和访问凭据，但不验证客户端会话，也不为同一次读取再次查询请求设备状态。请求结构不合法时返回 `bad_request`，证书、请求或邀请签名无效时返回 `invalid_signature`，签名查询用于自身读取或访问凭据不满足设备查询权限时返回 `forbidden`。

当前连接中继可以按自己的新鲜度策略检查 `created_at`；跨中继读取时，目标中继再按自己的策略独立检查。`created_at` 超前或过旧而未通过该检查时返回 `clock_skew`；客户端检查时间并重新生成、签署查询请求。目标中继返回的 `clock_skew` 须按客户端所用传输方式的错误映射规则返回调用方。

使用 [`ContactInvite`](../concepts/contacts.md#contactinvite) 时，目标中继必须确认邀请由目标账户签发，从该账户当前 `AccountDeviceState` 中找到有效的邀请签署设备，并使用其设备签名公钥验证邀请签名；邀请的 `expires_at` 必须晚于验证时的当前时间。此方式不要求目标账户启用公开发现或双方已建立联系人关系。邀请签名无效时返回 `invalid_signature`；邀请账户不符、已到期或签署设备不再有效时返回 `forbidden`。无效邀请不得退回公开查询。
