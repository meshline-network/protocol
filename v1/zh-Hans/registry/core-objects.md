# 中继注册表核心对象

[中继注册表](README.md)

## 中继 ID

`relay_id` 标识中继的 Neo 账户，是该账户 script hash 的规范文本形式：小写、带 `0x` 前缀的 40 个十六进制字符。Registry ABI 使用 `UInt160` 表示该值。网络协议中的文本 `relay_id` 必须匹配 `^0x[0-9a-f]{40}$`，按完整字符串比较；非规范形式必须拒绝，不得通过大小写转换后接受。

## `RelayEntry`

`RelayEntry` 是 `getRelay` 和 `listRelays` 返回的 ABI 结构，表示一个公共中继的当前成员状态。字段按下表顺序返回：

| 字段 | 逻辑类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `relay_id` | UInt160 | 是 | 中继的链上身份；转换为协议文本时使用[中继 ID](#中继-id)定义的格式 |
| `endpoint` | string | 是 | 规范 HTTPS 基地址；必须以 `https://` 开头，字段值的 UTF-8 编码不得超过 512 bytes，且不得包含空白、query、fragment、userinfo 或反斜杠 |
| `status` | string | 是 | 本条 Registry 中继成员资格的当前状态：`active` 表示该中继可作为候选公共中继，`disabled` 表示运营者已停用该资格，`suspended` 表示 Registry 治理方已暂停该资格；后两者均不得作为候选中继 |
| `updated_at` | unsigned integer | 是 | 最近一次创建、端点更新或状态更新的 UTC Unix 毫秒 |
