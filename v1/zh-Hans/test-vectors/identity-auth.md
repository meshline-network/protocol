# 身份与认证测试向量执行说明

[规范测试向量](README.md) · [通用执行规则](README.md#通用执行规则)

## 覆盖范围

文件：[`identity-auth-v1.json`](../../test-vectors/identity-auth-v1.json)。章节为 `device_identity`、`device_certificate`、`relay_origin` 和 `session_auth`。

## 固定输入与引用

`device_identity` 和 `device_certificate` 分别提供设备派生输入及账户、设备测试密钥。`session_auth.signers` 复用这些输入，按下表还原字段：

| 引用字段（相对于 `session_auth.signers`） | 同文件目标 |
|---|---|
| `account_ref` | `/device_certificate/account` |
| `account_private_key_ref` | `/device_certificate/private_key` |
| `account_public_key_ref` | `/device_certificate/public_key` |
| `device_private_key_ref` | `/device_certificate/device_private_key` |
| `device_public_key_ref` | `/device_certificate/device_public_key` |
| `device_id_ref` | `/device_identity/derived_device_id` |

`source` 只说明测试密钥来源。`target` 表示客户端从已验证描述符取得的目标身份和 endpoint，`challenge` 提供固定测试 challenge。设备证书位于 `session_auth.device_auth.request.signer_certificate`，须验证双重签名和设备 ID 派生。

## 执行步骤与断言

### 设备身份与证书

`device_identity` 给出身份派生输入、Canonical JSON、UTF-8 bytes、摘要和设备 ID。`device_certificate` 给出账户及设备测试密钥、未签名证书、两次签名输入和结果；先验证设备签名，再保留该签名重建账户签名输入，验证双签名和设备 ID 派生。

### Origin 与会话

#### Origin 规范化

`relay_origin.normalization_cases` 将 `endpoint` 转为 `expected_origin`，其 UTF-8 bytes 必须等于 `expected_origin_utf8_hex`；`comparison_cases` 先规范化两个 endpoint 再比较，结果必须等于 `expected_same_origin`。设备与账户认证均使用该结果填入签名输入的 `origin`。

origin 向量中的 endpoint 还须通过[端点格式校验](../client-relay/core-objects/relay-descriptor.md#中继端点地址)。认证 origin 的规范化不改写签名描述符中的地址，也不能使格式无效的端点变为有效；候选拒绝与请求路径构造按[中继发现](../client-relay/concepts/discovery-and-sessions.md#中继发现)和[方法与请求映射](../client-relay/methods/conventions.md#方法与请求映射)验证。

#### 认证输入与签名

对 `device_auth` 与 `account_auth`，分别从 `request`、可信目标和网络上下文按[会话认证](../client-relay/methods/authentication-and-sessions.md#会话认证)规则重建本地 `auth_payload`，加入 `$context`，再比对 Canonical JSON、UTF-8 bytes、SHA-256 和签名。`request` 是线上请求参数，其他派生输入与断言字段不加入请求。

#### 认证验证与拒绝

`verification_cases` 对两种认证分别执行。以本项 `trusted_relay_id` 作为接收中继自身身份，从 `endpoint` 计算 origin，使用本项 `network_context`；出现 `nonce_override` 时替换请求 nonce，出现 `request_extra_fields` 时只将其合入请求，不能改变可信中继身份。其余请求字段保持原值，使用 `signature_field` 指定的原签名，按新规则重建输入并核对 `expected_signature_valid`。

`legacy_signing_input_utf8_hex` 与 `legacy_signature` 仅提供省略 relay_id 的旧输入及其有效签名，供拒绝测试使用。该签名对旧输入有效，但必须无法通过含可信 relay_id 的新输入验证；验证方不得尝试旧输入作为回退。

相同中继的 HTTPS/WSS 或同 origin 路径变体只断言签名输入等价，不代表允许复用连接、nonce 或会话令牌。这些向量不包含 Registry/描述符验证、challenge 状态、设备当前授权和实际会话建立。
