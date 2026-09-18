# 消息加密测试向量执行说明

[规范测试向量](README.md) · [通用执行规则](README.md#通用执行规则)

## 覆盖范围

文件：[`message-encryption-v1.json`](../../test-vectors/message-encryption-v1.json)。章节为 `envelope_signature`、`payload` 和 `timeline`。

## 固定输入与引用

`envelope_signature` 保留单独给出的签名输入与签名结果，其两项外围输入按下表还原：

| 引用字段（相对于 `envelope_signature`） | 同文件目标 |
|---|---|
| `unsigned_object_ref` | `/payload/encryption/envelope` |
| `recipient_boxes_ref` | `/payload/encryption/recipient_boxes` |

`payload.aad` 提供原始 AAD；`payload.encryption` 提供 X25519/HKDF/AES-GCM 的固定输入与结果。`timeline` 是包含收发双方密钥盒的独立完整请求用例。

## 执行步骤与断言

### 信封签名与收件方解密

从还原的未签名信封重建签名输入，比对给定输入与签名，并验证签名。执行收件方密钥盒解封及正文解密，逐项比对 AAD、密钥派生与加解密结果。

### AAD 认证拒绝

`payload.aad_rejection_cases` 使用 `payload.encryption` 的固定内容密钥、nonce 和密文。先从该信封与 `network_context` 重建消息 AAD 对象，再用各项 `aad_overrides` 替换指定输入字段，重新生成 Canonical JSON bytes 后直接执行 AES-GCM 认证解密；`expected_authenticated: false` 要求认证失败且不交付明文。

覆盖消息 ID、创建时间、发送账户、发送设备、目标账户及网络编号和 Registry 地址分别变化的上下文错配；不得仅以信封验签失败代替该认证解密检查。

### 收发双方密钥盒

`timeline` 中密钥盒的 KDF/AAD 输入、共享秘密、封装密钥和解密结果都是精确协议 bytes；实现还必须确认原信封设备签名有效，并能通过发送方密钥盒解密同一 payload。
