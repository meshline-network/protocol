# 公共基础测试向量执行说明

[规范测试向量](README.md) · [通用执行规则](README.md#通用执行规则)

## 覆盖范围

文件：[`common-v1.json`](../../test-vectors/common-v1.json)。章节为 `canonical_json`、`base64url`、`unsigned_varint`、`object_types`、`network_binding`、`x25519` 和 `encrypted_payload`。

## 固定输入与引用

各章节使用自身给出的固定输入；网络绑定操作使用文件根 `network_context`。支持类型集合、容器原值及 X25519 测试密钥均由对应章节给出。

`object_types.message_authentication.envelope_ref` 和 `network_binding.signature_context.envelope_ref` 均引用 `/object_types/signed_envelope/envelope`；展开后分别用于 AAD 认证和候选上下文验签，断言彼此独立。

## 执行步骤与断言

### JSON 与编码

#### Canonical JSON

`canonical_json.vectors` 覆盖 Canonical JSON、Unicode、控制字符、安全整数及网络绑定输入；`rejection_vectors` 覆盖重复属性、孤立代理项、负零、非整数表示及越界整数，按通用执行规则比对或拒绝。

#### base64url

`base64url.cases` 对 `input` 文本执行规范编码检查。提供 `prefix` 时要求精确匹配并只对其后的部分执行 base64url 检查；提供 `decoded_length` 时还要求解码字节数相等。结果必须等于 `expected_accepted`，接受项的 bytes 必须等于 `decoded_hex`。

用例只判断编码及声明的前缀、长度，不免除真实对象的身份派生、签名、随机生成或其他业务校验。空字符串接受项只说明编码本身有效，不放宽字段非空要求；拒绝项不得先改写输入再接受。

#### unsigned-varint

`unsigned_varint.prefix_cases` 使用 `input_hex` 指定待检查前缀的完整 bytes；读取这些 bytes 后已到流尾，不完整前缀必须拒绝。结果须等于 `expected_accepted`，接受项的精确整数须等于十进制字符串 `decoded_value_decimal`，编码该整数也须得到相同 bytes；该字符串仅用于测试中精确表示超出 JSON 安全整数范围的二进制长度。

`length_limit_cases` 引用已接受的 `prefix_case`，再与测试给定的 `max_payload_bytes` 比较，结果须等于 `expected_within_limit`。

这些向量只验证前缀编码和声明长度，不包含 payload；前缀 `00` 的编码有效性不代表零长度消息满足相应传输或业务规则，也不能把格式合法的超大数值当作允许接收的消息长度。

### 类型与网络绑定

#### 对象类型

`object_types.supported_content_types` 是该组分派测试的已支持类型集合，不是全部协议类型。`content_type_cases` 先检查必需字符串 `$type`，再执行完整、大小写敏感匹配；`expected` 中的对象名仅表示选择该对象的后续验证规则，不代表已经通过全部验证，`unsupported_type` 不得分派到已知类型或触发未支持的状态变更，`invalid_type` 必须拒绝。

`signed_envelope.cases` 只按用例替换或删除信封根 `$type`，保留原签名，重新构造网络绑定签名输入后核对验签结果。

`message_authentication.cases` 从原信封重建消息 AAD，再仅替换或删除 AAD 根 `$type`，直接执行 AES-GCM 认证；失败不得交付明文。

向量中的 `.v1`、`.v2` 和其他后缀仅用于未知类型测试，不注册新类型。

类型分派用例中的普通 `type` 不是 `$type` 的别名；`expected_preserved_fields` 指定分派后必须原样保留的未知属性，不参与类型选择。

#### 网络上下文

`network_binding.format_cases` 检查输入是否为合法的完整上下文字符串，不得先规范化；接受结果必须等于 `expected_accepted`。

`binding_cases` 使用文件的可信 `network_context`：`device_signature` 和 `account_signature` 分别只移除对应根签名字段，保留嵌套签名，再注入 `$context`；`local_input` 检查已有 `$context` 与可信值完全一致且只出现一次。

`nested_protocol_object_paths` 指定本用例中须独立检查的嵌套协议对象路径，路径元素为属性名或数组索引；真实实现依据对象结构识别这些边界。传输对象根或这些嵌套对象出现 `$context` 时必须在构造输入前拒绝，值相等或为 `null` 也不例外。接受项逐 byte 比对 Canonical JSON、UTF-8 和 SHA-256；拒绝项不得产生这些结果。

`signature_context.cases` 保留原信封和签名，仅更换测试提供的可信上下文，独立重建签名输入并验签。这些断言只验证输入构造与密码学绑定，不代表已经通过完整业务验证；`forbidden_wire_context` 和 `context_mismatch` 是测试标签，不是协议错误码。

### 密码学原语与密文容器

#### X25519

`x25519.cases` 的每一项使用无 padding base64url 编码的 `private_key` 和 `peer_public_key` 作为 X25519 输入。`expected_raw_shared_secret` 表示底层 X25519 数学运算的预期 bytes；`expected_accepted` 为 `true` 时必须得到相同的非零共享秘密，为 `false` 时必须按 [X25519 共享秘密校验](../general.md#x25519-共享秘密校验)中止密钥盒操作，不得把全零结果送入 HKDF。密码库直接拒绝该密钥协商也是合规结果，不要求对外返回全零 bytes。

该检查同时适用于封装端使用目标公钥和解封端使用 `enc`，覆盖消息密钥盒与两类群秘密盒；不得仅以之后的 AES-GCM 认证失败代替全零检查。

正向输入来自 RFC 7748 第 6.1 节；负向输入包含 `u = 0`、`1`、`p - 1`、`p`、`p + 1`（`p = 2^255 - 19`），以及设置 `u = 0`、`1` 编码最高位的变体。该章节仅测试密码学原语，不使用网络上下文。

#### 密文容器

`encrypted_payload.cases` 仅断言共用密文容器的结构合法性。从 `encrypted_payload.input` 复制后，按 `path` 替换 `value` 或执行 `remove`；空路径操作整个容器。未知算法、缺字段、非法类型、nonce 长度或编码错误、密文不足 tag 长度均须拒绝，不能用信封顶层 `ciphertext` 补齐缺失的 `payload`。只有 tag 的容器通过此处结构校验，不表示 AEAD 或业务 JSON 有效。
