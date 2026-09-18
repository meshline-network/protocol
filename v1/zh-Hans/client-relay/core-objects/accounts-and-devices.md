# 账户资料与设备证书

[客户端—中继协议](../README.md) · [核心对象索引](README.md)

## 账户 ID

账户 ID 采用 [CAIP-10](https://chainagnostic.org/CAIPs/caip-10)，格式为 `<namespace>:<reference>:<account_address>`。前两段组成 [CAIP-2](https://chainagnostic.org/CAIPs/caip-2) 链标识，命名空间及链标识的具体规则参照 [Chain Agnostic Namespaces](https://github.com/ChainAgnostic/namespaces)。

账户 ID 按完整字符串进行大小写敏感比较，不得执行 Unicode 归一化。

### Neo N3

Neo N3 账户 ID 的格式为 `neo:<reference>:<address>`；链标识采用 [Neo CAIP-2 配置](https://namespaces.chainagnostic.org/neo/caip2)，并适用以下规则：

- `reference` 是 Neo N3 network magic 的规范无符号十进制文本，必须匹配 `^(0|[1-9][0-9]{0,9})$`，解析值必须在[网络上下文](../../general.md#网络上下文)定义的 network magic 取值范围内，不得使用前导零、正号、空白或网络名称；
- `address` 必须由账户公钥按 [Neo N3 单签地址规则](https://docs.neo.org/docs/n3/foundation/Wallets.html#ordinary-address)派生，并使用地址版本 `0x35` 的 Base58Check 表示。

账户 ID 中的 network magic 必须等于可信[网络上下文](../../general.md#网络上下文)中的 network magic。

账户签名算法、签名格式和公钥表示遵循 Neo N3 钱包规范的 [Signature](https://docs.neo.org/docs/n3/foundation/Wallets.html#signature) 和 [Public Key](https://docs.neo.org/docs/n3/foundation/Wallets.html#public-key) 章节。

## 设备证书与状态

### `DeviceCertificate`

`DeviceCertificate` 是设备和账户共同签署的有限期证书。设备签名证明申请者持有证书所列设备签名私钥；账户签名批准该设备身份和本次有效期。证书只有被当前 `AccountDeviceState` 包含且当前时间满足 `not_before <= now < expires_at` 时，才代表当前有效设备。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.device.certificate` |
| `account` | string | 是 | 证书所属的[账户 ID](#账户-id)，必须与 `account_public_key` 按相应链的账户规则派生的账户一致 |
| `account_public_key` | string | 是 | 账户公钥，无 padding base64url；遵循[账户签名](../../general.md#账户签名)中的公钥表示约定 |
| `signing_public_key` | string | 是 | 32-byte Ed25519 设备签名公钥，无 padding base64url |
| `encryption_public_key` | string | 是 | 32-byte X25519 设备加密公钥，无 padding base64url |
| `not_before` | integer | 是 | 证书开始生效的 UTC Unix 秒 |
| `expires_at` | integer | 是 | 证书到期的 UTC Unix 秒；必须晚于 `not_before`，且二者间隔不得超过 720 天 |
| `device_signature` | string | 是 | 本设备对证书正文生成的 64-byte Ed25519 签名，无 padding base64url |
| `account_signature` | string | 是 | 账户对已经包含设备签名的证书按[账户签名规则](../../general.md#账户签名)生成的签名，无 padding base64url |

证书必须按以下顺序签署：

1. 设备签名输入排除根 `device_signature` 和 `account_signature`；设备使用 `signing_public_key` 对应私钥生成 `device_signature`。
2. 账户签名输入只排除根 `account_signature`，因此包含第 1 步得到的 `device_signature`；账户生成 `account_signature`。

验证方必须同时验证两个签名及账户公钥与账户 ID 的绑定。`DeviceCertificate` 的 Canonical JSON UTF-8 编码不得超过 4 KiB（4,096 bytes）。

续期时，按上述规则签署新证书。客户端应先持久化新证书，再把它纳入下一份账户设备状态。

证书后来到期、被替换或设备被移除，不追溯否定对象被接受时已经完成的签名和授权验证。

### 设备 ID

实现从 [`DeviceCertificate`](#devicecertificate) 的稳定身份字段构造下列设备身份输入；它只是规范化的派生输入，不是独立传输对象：

```json
{
  "$type": "meshline.device.identity",
  "account": "neo:860833102:...",
  "signing_public_key": "base64url...",
  "encryption_public_key": "base64url..."
}
```

设备 ID 按以下公式派生，其中 `device_identity_input` 表示上述设备身份输入：

```text
device_id = "dev_" + base64url(first_16_bytes(SHA-256(network_bound_json_bytes(device_identity_input))))
```

设备 ID 必须匹配 `^dev_[A-Za-z0-9_-]{22}$`，验证方必须从证书重新计算并逐字比较。

设备 ID 用于在账户作用域内索引设备、绑定会话和查询当前授权状态；完整 `DeviceCertificate` 提供设备公钥、证书有效期和双重签名。

有效期和签名不参与设备身份输入，因此同一设备使用相同账户和设备密钥续期时保持同一设备 ID；更换任一设备密钥会生成新的设备 ID。

### `AccountDeviceState`

`AccountDeviceState` 是账户设备权限的完整、原子快照。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.account.device.state` |
| `account` | string | 是 | 状态所属账户 ID |
| `account_public_key` | string | 是 | 必须派生出 `account` 的账户公钥 |
| `revision` | integer | 是 | 账户设备状态的非负单调版本 |
| `certificates` | array&lt;DeviceCertificate&gt; | 是 | 当前登记的完整设备证书集合，可以为空，最多包含 8 项 |
| `account_signature` | string | 是 | 账户对完整状态按[账户签名规则](../../general.md#账户签名)生成的签名，无 padding base64url |

账户签名排除根 `account_signature`。完整 Canonical JSON UTF-8 编码不得超过 128 KiB（131,072 bytes）。所有设备必须属于同一账户、通过设备证书的双重签名验证，并且派生的设备 ID 不得重复。

初始设备状态的版本推荐使用校准后的当前 UTC Unix 毫秒。

替换当前设备状态时必须使用严格更大的 `revision`。该值必须是[非负安全整数](../../general.md#安全整数与计数器推进)，并在同一账户内保持单调递增。

推荐以当前 UTC Unix 毫秒为下限，并确保新值高于当前已知版本：

```text
revision = max(current_revision + 1, current_unix_time_milliseconds)
```

设备状态变化和证书续期对会话的影响遵循[设备会话规则](../methods/authentication-and-sessions.md#会话有效性与连接绑定)。

## `AccountProfile`

`AccountProfile` 是账户向所有人公开的、由已授权设备签署的资料快照。任何知道完整账户 ID 的调用方均可按 [`profile.resolve`](../methods/profiles.md#profileresolve) 的接入规则读取，无需目标账户授权或联系人关系。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.profile` |
| `account` | string | 是 | 资料所属账户的[账户 ID](#账户-id) |
| `nickname` | string | 否 | 面向用户的显示名；非空时不得仅包含[空白字符](../../general.md#文本空白字符)，最多 256 UTF-8 bytes；账户 ID 是身份比较依据 |
| `avatar` | [ContentReference](messages-and-content.md#contentreference) | 否 | 头像内容引用；`content_type` 必须是图像媒体类型，例如 `image/png`；原文必须是图片内容 |
| `bio` | string | 否 | 简介；非空时不得仅包含[空白字符](../../general.md#文本空白字符)，最多 2 KiB（2,048 UTF-8 bytes） |
| `public_discovery` | boolean | 是 | `true` 开放当前设备集合和无邀请首次联系；`false` 关闭这两项公开能力 |
| `updated_at` | integer | 是 | 签署当前资料时的 UTC Unix 秒；用于比较资料的新旧 |
| `device_signature` | string | 是 | 发布者使用本次调用设备对当前 `AccountProfile`（排除本字段）生成的 64-byte Ed25519 签名，无 padding base64url |

完整 `AccountProfile` 的 Canonical JSON UTF-8 编码不得超过 8 KiB（8,192 bytes），计入 `device_signature`、`avatar` 引用对象和全部未知属性；各字段自身的约束仍须同时满足。发布及任何读取、消息或声明中携带的资料均适用此上限。

签名输入遵循[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)规则。中继接受发布时必须确认签名设备处于当前 `AccountDeviceState`；接受后签名设备被移除或证书到期不使已保存的当前资料自动失效。
