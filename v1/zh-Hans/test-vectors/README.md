# Meshline Protocol 1.0 规范测试向量

[Meshline Protocol 1.0](../README.md)

以下 8 个 JSON 文件提供实现无关的规范测试向量。每个文件包含执行该专题所需的固定输入，可独立读取。先阅读本页通用执行规则，再按专题执行说明中的“覆盖范围 → 固定输入与引用 → 执行步骤与断言”验证。

| 文件 | 专题 | 验证内容 |
|---|---|---|
| [`common-v1.json`](../../test-vectors/common-v1.json) | [公共基础](common.md) | Canonical JSON、base64url、unsigned-varint、类型分派、网络绑定、X25519、密文容器结构 |
| [`identity-auth-v1.json`](../../test-vectors/identity-auth-v1.json) | [身份与认证](identity-auth.md) | 设备身份派生、证书双签名、origin、设备与账户认证签名 |
| [`contacts-v1.json`](../../test-vectors/contacts-v1.json) | [联系人](contacts.md) | 授权签名与格式、授权选择与合并、邀请签名与类型 |
| [`message-encryption-v1.json`](../../test-vectors/message-encryption-v1.json) | [消息加密](message-encryption.md) | 信封签名、AAD 认证、payload 加解密、收发双方密钥盒 |
| [`message-content-v1.json`](../../test-vectors/message-content-v1.json) | [正文与附件](message-content.md) | 正文格式与渲染安全、附件加密、哈希引用解析、消息认证绑定 |
| [`channels-v1.json`](../../test-vectors/channels-v1.json) | [频道](channels.md) | 频道 ID、发布与编辑签名、连续编辑投影、附件引用解析 |
| [`groups-v1.json`](../../test-vectors/groups-v1.json) | [群组](groups.md) | 群 ID 与密码学、管理链与状态转换、证书及账户绑定、可见性、加密昵称与本地状态 |
| [`dht-keyspace-v1.json`](../../test-vectors/dht-keyspace-v1.json) | [DHT](dht-keyspace.md) | 资源 key 派生、FIND_NODE 请求与分帧、keyspace 映射与 XOR 距离 |

## 通用执行规则

其中的输入值、原始 UTF-8 bytes 和预期结果都是规范性数据。向量中的私钥只用于互操作测试，任何部署不得使用这些密钥。

### 文件结构与可信上下文

- 文件根统一使用 `$type: "meshline.protocol.test-vectors"` 和字符串 `protocol_version: "1.0"`，其余具名章节按专题组织。文件元数据不属于线上协议对象。
- 向量文件中的 `protocol_version` 和文件名中的 `v1` 标识适用的规范版本，不是协议对象的格式选择字段。对象及密码学输入只使用各自的 `$type`；按[对象类型](../general.md#对象类型)解释，不补入默认 `version`。
- `network_context` 和 `candidate_network_context` 是测试使用的可信上下文字符串，格式与 `$context` 相同，不是网络对象的字段。签名、哈希及定义为网络绑定的密码学输入使用 `$context`，网络传输对象不携带该字段；`aad_overrides` 中的 `$context` 只用于篡改本地 AAD 的认证失败测试。
- 根 `network_context` 是该文件涉及网络绑定操作时使用的可信值；纯编码、X25519、容器结构及原始 Peer ID 的 keyspace 运算不使用它。用例明确提供候选上下文时，只覆盖该项指定的测试输入。

向量中的[账户 ID](../client-relay/core-objects/accounts-and-devices.md#账户-id) 使用 CAIP-10 格式 `neo:<reference>:<address>`；涉及账户 ID 的密码学输入使用这一完整字符串，相应签名、标识符、哈希、密钥派生和加密结果须与之匹配。

### 精确数据与结果比对

- `input_json` 是需要解析的精确 JSON 文本，`input_utf8_hex` 是该文本的 UTF-8 bytes；两者解码后必须逐字相同。
- `canonical_json` 是规范化后的单行 JSON，`utf8_hex` 和 `utf8_base64` 是它的精确 UTF-8 bytes；实现不得通过重新格式化这些展示值替代原始 bytes 比较。
- `sha256_hex` 和 `sha256_base64url` 是同一 32-byte SHA-256 结果的两种表示；base64url 必须符合总则的[规范编码](../general.md#base64url-编码)。展示用 `utf8_base64` 是普通 base64，不是协议 base64url 字段。
- `rejection_vectors` 中的输入必须在生成签名、哈希或业务对象之前被拒绝；实现不得先改写为另一个 JSON 值后继续处理。
- 各专题中的签名输入、AAD、KDF info、密文、认证标签和签名均为精确协议 bytes，必须从固定输入独立重建并比对；账户 ECDSA 签名生成的比对遵循下述 nonce 规则。

对于 JSON 向量，实现应先验证 `input_json` 与 `input_utf8_hex` 一致，再执行向量指定的操作，并同时比对 Canonical JSON、原始 bytes、摘要和最终 ID 或 key；随后逐项确认相应拒绝用例不会产生 Canonical JSON。任何必须精确比对的结果不同都表示实现不兼容。

### 签名与密码学验证

向量中的账户 ECDSA 签名使用 RFC 6979 和 SHA-256 确定性生成：

- 实现采用该生成方式时，必须逐 byte 比对生成的签名。
- 采用协议允许的随机 nonce 时，必须独立重建并比对签名输入、验证向量所给签名，并验证自行生成的签名，不要求随机生成的签名字节等于向量值。
- 向量中的签名作为嵌套对象、后续签名或哈希的输入时，必须使用向量所给的原始签名字节，不能替换为另一次生成的签名后要求派生结果相同。
- Ed25519 签名及其他确定性结果仍须精确比对。

密码学向量还必须完成适用的签名验证、密钥盒解封、payload 解密和外部内容解密。

### 同文件输入引用

- 测试元数据中的 `<字段名>_ref` 替代同一位置的 `<字段名>`，值为以 `/` 开始的同文件 JSON Pointer；属性名中的 `~`、`/` 分别以 `~0`、`~1` 表示，数组项使用从 0 开始的索引。读取时复制指向的实际值，还原原字段后再执行用例。例如 `signing_device_ref: "/grants/signing_devices/0"` 还原为完整 `signing_device` 输入。
- 引用直接指向实际数据，不跨文件、不串联；字段和对应的 `_ref` 不同时出现。每项篡改用例独立复制展开后的输入，不能修改共享原值。
- 仅解析各专题执行说明明确列出的外围测试引用。完整传输对象、签名输入和预期响应内部保持原样；真实协议对象中的未知属性即使以 `_ref` 结尾，也不作为测试指令解析。
- 既有 `label`、`name`、`id`、`post_case`、事件索引等用例关联保持原规则。各专题执行说明中的字段路径相对于所指出的专题章节；文件根可信上下文及跨章节路径另行注明。

### 测试元数据与断言边界

`scope`、用例名称、输入变更、预期结果及投影等外围字段用于描述测试，不加入线上请求、响应、签名输入或业务对象。用例中的结果名称和标签只按执行说明解释，不自行注册协议字段、对象类型或错误码。

每项用例只断言列出的检查结果。格式通过、验签成功、AEAD 认证成功和业务授权有效须分别验证；其中一项通过不能代替其他适用检查。专题说明保留各组的具体边界，未覆盖的行为按下述一致性要求验证。

## 一致性测试边界

兼容实现必须通过适用的向量，并验证所实现模块的行为；确定性结果比对不能代替行为测试。

行为测试须覆盖正常路径、字段省略与非法输入、编码与签名篡改、数值及时间边界、文本与完整对象大小限制；涉及状态或异步处理时，还须覆盖并发、重复提交、响应或通知丢失、配置变化及重启恢复。一个方法支持多种传输形式时，其参数、授权、业务结果与错误语义必须一致。

字段约束、状态转换及预期结果由对应正文规定。以下入口按主题汇总验证范围，具体用例从正文规则和适用向量推导：

- [客户端—中继协议](../client-relay/README.md#一致性要求)覆盖中继发现、会话、账户状态、联系人和可靠消息；
- [频道托管协议](../client-relay/channels/README.md#一致性要求)覆盖频道 ID、签名、revision、权限、帖子删除、有限保留、sequence 缺口和时间线重建；
- [群组托管协议](../client-relay/groups/README.md#一致性要求)覆盖固定托管、分离秘密、成员与设备访问状态机、私有状态和关闭语义；
- [中继 DHT](../relay-dht/README.md#一致性要求)覆盖多节点存取、路由过期及重启后的版本防回退、同版本冲突保留、网络分区和无效 Peer；
- [中继 RPC](../relay-rpc/README.md#一致性要求)覆盖连接身份、跨中继查询、可靠投递、错误恢复和重启。

一致性验证必须至少使用一个参考实现与独立网络传输测试工具，或两个相互独立的实现执行互操作测试。
