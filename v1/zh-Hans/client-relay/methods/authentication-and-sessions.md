# 会话认证与生命周期

[客户端—中继协议](../README.md) · [发现与会话概念](../concepts/discovery-and-sessions.md)

## 会话认证

### 中继 origin 计算规则

认证签名中的 `origin` 和会话的 origin 绑定均从本次连接的目标 endpoint 计算。WSS 先将 scheme 替换为 `https`，保留主机和端口，再按 [RFC 6454](https://www.rfc-editor.org/rfc/rfc6454.html#section-6.2) 的 ASCII 序列化规则生成 origin：

- scheme 固定为 `https`；域名使用小写 ASCII，国际化域名按 [IDNA2008](https://www.rfc-editor.org/rfc/rfc5891.html#section-5) 转为 A-label，保留域名尾部的点；
- IPv4 使用点分十进制；IPv6 使用 [RFC 5952 第 4 节](https://www.rfc-editor.org/rfc/rfc5952.html#section-4)的十六进制规范形式，并保留方括号；
- 省略默认端口 `443`，其他端口使用无前导零的十进制；
- 不包含 userinfo、path、query、fragment 或尾随 `/`。

客户端生成签名、中继验签和会话 origin 比较必须使用同一结果。例如，`https://RELAY.example:443/meshline/v1` 与 `wss://relay.example/meshline/v1` 均得到 `https://relay.example`。该转换仅用于 origin，不改写 `RelayDescriptor` 或其签名输入；endpoint 本身仍须满足[地址规则](../core-objects/relay-descriptor.md#中继端点地址)。

### `auth.challenge`

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/auth/challenge` |
| 会话要求 | 无需 |
| WSS | `auth.challenge` |
| HTTP 成功状态 | `200 OK` |

#### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | [账户 ID](../core-objects/accounts-and-devices.md#账户-id) |

#### 响应对象

成功响应表示中继针对请求账户签发的一次性 challenge；后续两个验证方法都使用其中的 `nonce`。客户端不得将它用于所绑定账户或签发它的中继以外的认证。`created_at` 和 `expires_at` 均由中继生成，使客户端可以观察中继时间并估算 challenge 的剩余有效期；这两个响应字段均不进入设备或账户会话签名输入，设备认证仍使用客户端自行生成的 `timestamp`：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `nonce` | string | 是 | 中继生成并在首次验证尝试时消费的一次性 challenge 值；由 32-byte 密码学安全随机值完整编码而成；必须是非空字符串，最多 256 个可见 ASCII 字符（`U+0021` 至 `U+007E`） |
| `created_at` | integer | 是 | 中继生成 challenge 时的当前 Unix 秒；用于向客户端公开中继时间 |
| `expires_at` | integer | 是 | 该 challenge 的到期 Unix 秒，采用与 `created_at` 相同的中继时间基准，必须晚于 `created_at` |

```json
{"nonce":"base64url...","created_at":1730000000,"expires_at":1730000300}
```

#### 处理规则

中继确认账户 ID 有效后生成 `nonce`，并将其绑定到该账户和到期时间。同一 challenge 可以提交给 `auth.device.verify` 或 `auth.account.verify`；中继根据实际调用的验证接口和通过验证的证明建立相应模式的会话。

中继返回的 `expires_at` 必须与验证时采用的到期时间一致。两个验证方法均须先检查 nonce 的账户绑定、消费状态和到期时间；中继当前时间达到 `expires_at` 时即视为过期，缺失、过期或已消费均返回 `unauthorized`。

已知 nonce 必须在首次验证尝试时消费，无论该次验证成功或失败。

### `auth.device.verify`

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/auth/device/verify` |
| 会话要求 | 无需 |
| WSS | `auth.device.verify` |
| HTTP 成功状态 | `200 OK` |

#### 请求参数

请求参数证明请求方持有指定设备的 Ed25519 私钥，并把证明绑定到目标中继 ID、origin 和本次 nonce。中继按下文[处理规则](#处理规则-1)验证证明并确认该设备当前有效：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `nonce` | string | 是 | 必须逐字等于对应 `auth.challenge` 响应中尚未消费且未过期的 `nonce` |
| `timestamp` | integer | 是 | 客户端构造认证证明时的当前 Unix 秒 |
| `signer_certificate` | DeviceCertificate | 是 | 双重签名必须有效，`account` 必须逐字等于对应 `auth.challenge` 请求的 `account`；中继从该证书派生设备 ID，并按下文[处理规则](#处理规则-1)确认该设备当前有效 |
| `device_signature` | string | 是 | 按下节设备会话认证签名输入生成的 64-byte Ed25519 签名，无 padding base64url |

##### 设备会话认证签名输入

客户端为请求参数中的 `device_signature` 构造以下认证对象 `auth_payload`。该对象只用于生成和验证签名，不在网络上传输：

```json
{
  "$type": "meshline.relay.auth",
  "relay_id": "0x1234567890abcdef1234567890abcdef12345678",
  "origin": "https://relay.example",
  "account": "neo:860833102:...",
  "device_id": "dev_...",
  "nonce": "base64url...",
  "timestamp": 1730000000
}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.relay.auth` |
| `relay_id` | string | 是 | 中继 ID |
| `origin` | string | 是 | 按[中继 origin](#中继-origin-计算规则)计算的目标 origin |
| `account` | string | 是 | 必须等于对应 `auth.challenge` 请求的 `account` |
| `device_id` | string | 是 | 按[设备 ID](../core-objects/accounts-and-devices.md#设备-id)规则从请求的 `signer_certificate` 派生 |
| `nonce` | string | 是 | 逐字复制对应 `auth.challenge` 响应中的 `nonce` |
| `timestamp` | integer | 是 | 客户端构造认证证明时的当前 Unix 秒；逐字复制到请求参数中的 `timestamp` |

签名输入为 `network_bound_json_bytes(auth_payload)`，由[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)规则加入可信 `$context` 并生成 Canonical JSON UTF-8 bytes；客户端用设备 Ed25519 私钥签署所得 bytes。

#### 响应对象

成功响应为 [`SessionCredentials`](#sessioncredentials)，`mode` 必须为 `device`。消息时间线通知的启用遵循 [`message.timeline.changed`](../notifications/README.md#messagetimelinechanged) 的规则。

#### 处理规则

中继先按 [`auth.challenge` 的处理规则](#处理规则)检查并消费 nonce，再按本地时钟策略检查客户端 `timestamp`，超出允许偏差时返回 `clock_skew`；字段类型或表示不合法返回 `bad_request`。随后按[设备会话认证签名输入](#设备会话认证签名输入)规则，使用设备证书中的签名公钥验证请求的 `device_signature`。

当前连接中继负责该账户时，直接读取本地权威状态；否则向该账户的当前归属中继调用 [`device.status`](../../relay-rpc/methods/account-queries.md#devicestatus)，只提交该方法定义的查询参数，认证证明仍由当前连接中继验证。查询账户和设备必须与本次认证一致；响应验证与缓存遵循该方法的规则。未确认设备当前有效时不得建立会话。

设备认证的时间检查用于在业务调用前提前发现客户端与当前中继的时钟偏差。客户端应以同一时间基准生成认证时间和后续请求时间。收到 [`clock_skew`](conventions.md#错误码) 后，可以参考 `auth.challenge.created_at` 或 `relay.info.server_time` 判断偏差；决定重试时，必须重新调用 `auth.challenge` 并签署新的认证证明。

### `auth.account.verify`

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/auth/account/verify` |
| 会话要求 | 无需 |
| WSS | `auth.account.verify` |
| HTTP 成功状态 | `200 OK` |

#### 请求参数

请求参数证明请求方持有账户私钥；请求必须携带账户公钥，使尚未保存该账户设备状态的中继也能按[账户 ID](../core-objects/accounts-and-devices.md#账户-id)中的派生规则核对账户，并按[账户签名规则](../../general.md#账户签名)验证签名：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `nonce` | string | 是 | 必须逐字等于对应 `auth.challenge` 响应中尚未消费且未过期的 `nonce` |
| `account_public_key` | string | 是 | 账户公钥，无 padding base64url；遵循[账户签名](../../general.md#账户签名)中的公钥表示约定；按[账户 ID](../core-objects/accounts-and-devices.md#账户-id)规则派生出的账户 ID 必须逐字等于对应 `auth.challenge` 请求的 `account` |
| `account_signature` | string | 是 | 账户私钥对下节账户会话认证签名输入按[账户签名规则](../../general.md#账户签名)生成的签名，无 padding base64url |

##### 账户会话认证签名输入

客户端为请求参数中的 `account_signature` 构造以下认证对象 `auth_payload`。该对象只用于生成和验证签名，不在网络上传输：

```json
{
  "$type": "meshline.relay.account_auth",
  "relay_id": "0x1234567890abcdef1234567890abcdef12345678",
  "origin": "https://relay.example",
  "account": "neo:860833102:...",
  "account_public_key": "base64url...",
  "nonce": "base64url..."
}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.relay.account_auth` |
| `relay_id` | string | 是 | 中继 ID |
| `origin` | string | 是 | 按[中继 origin](#中继-origin-计算规则)计算的目标 origin |
| `account` | string | 是 | 本次申请建立账户会话的账户 ID；必须逐字等于对应 `auth.challenge` 请求中的 `account` |
| `account_public_key` | string | 是 | 逐字复制请求参数中的 `account_public_key` |
| `nonce` | string | 是 | 逐字复制对应 `auth.challenge` 响应中的 `nonce` |

签名输入为 `network_bound_json_bytes(auth_payload)`，由[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)规则加入可信 `$context` 并生成 Canonical JSON UTF-8 bytes；客户端按[账户签名规则](../../general.md#账户签名)签署所得 bytes。

#### 响应对象

成功响应为 [`SessionCredentials`](#sessioncredentials)，`mode` 必须为 `account`。

#### 处理规则

中继按 [`auth.challenge` 的处理规则](#处理规则)检查并消费 nonce。随后根据对应 `auth.challenge` 请求中的 `account` 确定链和网络，核对 `account_public_key` 与该账户的绑定，并按[账户会话认证签名输入](#账户会话认证签名输入)规则验证请求的 `account_signature`。

## 会话凭据与生命周期

### `SessionCredentials`

`auth.device.verify` 和 `auth.account.verify` 成功时都返回 `SessionCredentials`：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `token` | string | 是 | 中继签发的会话令牌；作为 bearer credential，只对签发它的中继 origin、账户和会话模式有效；设备会话还绑定设备 ID |
| `mode` | string | 是 | 本次建立的会话模式；`auth.device.verify` 必须返回 `device`，`auth.account.verify` 必须返回 `account` |
| `expires_at` | integer | 是 | 会话到期 Unix 秒；中继按自己的部署策略决定具体期限并返回准确值，设备会话不得晚于本次认证确认的最新设备证书到期时间 |

设备会话的证书期限上限取自本次认证使用的当前设备状态：建立会话的中继是账户归属中继时，使用本地当前权威状态中该设备最新证书的 `expires_at`；其他中继使用 `device.status` 返回且已验证的 `active` 结果中的 `expires_at`，包括按前述规则仍可用于认证的缓存结果。使用旧证书证明同一设备身份时，上限仍取自已确认的最新证书，不以请求所附旧证书的期限代替。该上限同样适用于 WebSocket 续期时建立的新设备会话；账户会话的期限由中继自行决定。

中继生成会话令牌时，抗猜测和抗伪造安全强度不得低于 128 bit。建议使用密码学安全随机源为每个新会话生成至少 16 bytes 的随机值，并将其完整编码为 `token`。令牌必须是非空字符串，最多 256 个可见 ASCII 字符（`U+0021` 至 `U+007E`）。令牌区分大小写。客户端必须将其作为不透明值逐字保留并完整使用，不得从中解析时间、账户、设备或路由信息。签发中继不得在尚有效或仍保留用于防重放判断的会话记录中复用同一令牌。

客户端必须确认响应中的会话模式与本次请求一致；返回其他模式时不得使用或缓存该会话令牌。客户端还必须防止泄露 `token`，不得把它发送给其他中继。

### 会话有效性与连接绑定

设备会话是中继对建立会话时设备状态的短期判断；中继可以在其存续期间接受该会话，而不为每个客户端请求重新查询设备状态。同一设备 ID 以相同密钥续期并换用新证书时，既有设备会话可以在原 `expires_at` 之前继续有效，证书续期不自动延长会话期限；新建设备会话也只要求该设备 ID 在最新权威状态中仍然有效。

建立会话的中继一旦得知设备已被移除、密钥已经变化或最新证书已经失效，就必须立即使本地全部相关设备会话失效，并停止依赖这些会话的推送和订阅。尚未获知变化的中继可以继续接受已建立的设备会话，直到会话自行到期或 WebSocket 连接重建时重新验证；`active` 结果的短期缓存还可能允许设备建立新会话，直到缓存到期或中继获知新状态。

每个新建立的 WebSocket 连接在调用需要会话的方法前，都必须执行 `auth.challenge` 和与所选模式对应的验证方法，不得使用先前连接的 `token` 将原会话绑定到新连接。未认证连接只能调用认证接口和公开读取方法。连接成功绑定一种模式后不得改绑账户、设备或模式，但可以按下节在原连接上续期。只有设备会话连接可以建立订阅。

HTTP 请求使用会话令牌作为跨请求的持有者凭据，底层连接变化不改变会话的有效性；每次请求仍须通过会话有效性、会话模式及相应方法的权限和业务校验。

### WebSocket 会话续期

客户端可以在当前会话仍有效时，在原 WebSocket 连接上重新调用 `auth.challenge` 和对应模式的验证方法。`auth.challenge` 的账户、认证证明的账户以及所用会话模式必须与连接已绑定的身份一致，设备会话还必须保持同一设备 ID；尝试改绑时返回 `forbidden`。续期使用新的 challenge，并执行相应验证方法的全部认证规则，包括设备认证的时间检查、当前设备状态判断及其缓存约束，不能仅凭原会话延长期限。

续期生效时，原会话必须仍有效。认证成功后，中继建立新会话并签发新会话令牌，通过 `SessionCredentials` 返回结果，以新会话替换本连接的绑定，后续有效期采用新响应的 `expires_at`；原 `token` 的有效期不因续期延长。仍有效的通知启用状态、频道和群订阅继续保留，不重建群设备访问区间，也不重置同步位置。续期本身不要求客户端重新订阅或补同步；其他状态变化、通知丢失等情形的同步要求继续适用。

认证失败时返回相应错误，不延长原会话，也不因这次失败改变原连接绑定或仍有效的订阅；原会话在自身有效期内可以继续使用。如果中继在认证过程中得知设备已经失效，仍须立即撤销相关会话和订阅。原会话已经到期或被撤销时，不能在原连接上续期或恢复认证，返回 `unauthorized`；客户端必须重新连接并认证，开始续期不暂停原会话的到期判断。
