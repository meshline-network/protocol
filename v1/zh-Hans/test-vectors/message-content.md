# 正文与附件测试向量执行说明

[规范测试向量](README.md) · [通用执行规则](README.md#通用执行规则)

## 覆盖范围

文件：[`message-content-v1.json`](../../test-vectors/message-content-v1.json)。章节为 `body`、`attachment_encryption` 和 `hash_references`。

## 固定输入与引用

`body.media` 提供附件原文及引用；`attachment_encryption` 和 `hash_references` 中的加密用例分别保留自身的明文、密钥、AAD 与预期结果。`hash_references.resolution_cases` 只在本项提供的附件数组中解析引用。

## 执行步骤与断言

### 正文格式与渲染

`body.body_cases` 均为有效正文用例；提供 `interpretation` 时，还须校验相应解释方式。`invalid_body_cases` 必须被拒绝，`rendering_safety_cases` 给出原始 HTML 和不安全链接的处理要求。

正文向量中的有效 `content_type` 可以省略 `charset` 或使用 `utf-8`，参数名和值不区分大小写；`body_cases` 覆盖这些有效形式，`invalid_body_cases` 中的字符集参数用于验证其他字符集和空值的拒绝行为。

### 附件加密

`attachment_encryption` 提供加密 `ContentReference`、原始明文、精确 AAD 和带 tag 的密文；独立比对加密输入并验证外部内容解密。

### 哈希引用与解析

`hash_references.uri_generation` 从固定原文计算 SHA-256 文本和 `ni:` URI，`hash_cases` 校验附件哈希字段，`resolution_cases` 仅在各自提供的附件中匹配；`resolved` 的 `index` 是该用例附件数组的预期位置，`unresolved` 表示未匹配到目标，`invalid_reference` 表示引用格式无效，`invalid_attachments` 表示附件字段无效或哈希重复。

`markdown_cases` 的 `expected_targets` 只包含实际解析出的 `ni:` 图片和链接，不包含代码、被转义的语法、纯文本或未知格式中的字面文本。

### 附件引用的消息认证

`hash_references` 中的 `encrypted_attachment` 和 `re_encrypted_attachment` 提供两组附件加密输入与输出，用于校验原文摘要、AAD、密文和解密结果。

`private_message` 和 `group_message` 给出精确正文 bytes、AAD、密文和签名，账户消息使用固定内容密钥，群消息从给定群应用秘密派生 32-byte `message_key` 并使用固定测试输入 `message_nonce`；均不涉及收发设备的密钥盒构造。

修改正文哈希 URI 或附件引用而不重新生成消息认证数据时必须失败；附件本身的解密和原文摘要校验仍独立执行。
