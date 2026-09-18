# 频道测试向量执行说明

[规范测试向量](README.md) · [通用执行规则](README.md#通用执行规则)

## 覆盖范围

文件：[`channels-v1.json`](../../test-vectors/channels-v1.json)。包含 `channel_id`、`media`、`channel_signer`、`channel_write_cases` 和 `channel_edit_sequences`。

## 固定输入与引用

`media` 给出附件原文及引用，`channel_signer` 是 7 项发布与编辑签名用例共用的测试密钥。

`channel_edit_sequences` 的 `post_case` 指向同文件 `channel_write_cases` 中的初始帖子，`post_sequence` 给出其时间线位置。

## 执行步骤与断言

### 频道 ID

`channel_id` 从给定网络上下文和 ID 输入重建 Canonical JSON 与 SHA-256，取摘要前 16 bytes 加 `chan_` 前缀；所有中间值和最终 ID 均须比对。

### 发布与编辑签名

`channel_write_cases` 给出完整签名业务对象，频道帖子还验证消息 ID 的签名绑定。纯文本编辑以 `attachments: null` 删除附件字段，纯附件编辑以 `body: null` 删除正文。

任意改动消息 ID、正文类型、文本、附件引用或字段的省略、`null`、`[]` 表示而不重新签署时，签名验证必须失败。涉及哈希引用的用例还须验证编辑后的当前附件匹配。

### 连续编辑与当前投影

各 `steps` 按接受顺序应用签名编辑对象；`applied` 给出更新后的正文、有效附件和引用解析结果，`no_change` 表示请求成功但不产生编辑事件，删除的字段不出现在投影中，显式空数组仍保留；`bad_request` 表示拒绝且状态不变。

用例覆盖正文与附件的省略、`null` 删除、对象及数组完整替换、连续编辑、无变化编辑、旧内容不得重新出现、无内容编辑和重复哈希拒绝。
