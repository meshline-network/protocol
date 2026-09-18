# 联系人测试向量执行说明

[规范测试向量](README.md) · [通用执行规则](README.md#通用执行规则)

## 覆盖范围

文件：[`contacts-v1.json`](../../test-vectors/contacts-v1.json)。章节为 `signing`、`grants` 和 `invites`。

## 固定输入与引用

`signing.vector` 提供独立签名用例；`grants.signing_devices` 提供授权用例使用的测试密钥、设备 ID 和双签名证书。

`grants.verification_time` 是测试使用的当前时间，`grants.current_valid_devices` 是当前授权设备的标签集合；它是测试前提，不是账户签名的设备状态。

`invites.invites` 按 `label` 提供完整对象、精确签名输入及摘要；使用 `invites.signing_device_ref` 从 `/grants/signing_devices/0` 还原的测试设备密钥验证。

## 执行步骤与断言

### 授权签名与选择

#### 授权签名

`signing.vector` 直接签署 `grant` 排除根 `signatures` 后的完整正文，使用 `network_context` 构造网络绑定输入，与 `signing_input_canonical_json`、`signing_input_utf8_hex` 和 `signature` 比对。正文中的 `future_data` 必须参与签名。该项的 `device_id` 是固定测试映射键，空 `signatures` 仅用于构造签名输入，不是有效传输授权。

`signing.verification_cases` 从 `signing.vector` 独立开始。先删除 `grant_remove_fields` 指定的正文根字段，再合入 `grant_overrides`；提供 `device_id`、`signature`、`network_context` 或 `public_key` 时覆盖对应测试输入，不重新签署。将待验证签名视为对应设备 ID 的映射值，按排除整个根 `signatures` 的规则重建签名输入，与 `expected_signature_valid` 比对。用例只断言密码学验签，不免除对象类型、设备身份、当前授权或字段规则；映射键不受此签名保护，不能据此推断授权有效。

#### 授权选择与合并

`grants.grants` 提供完整授权及各设备共用的 `signing_input_utf8_hex`，使用 `signing_devices` 中的测试密钥和双签名证书逐项验证 `signatures`。

每项 `selection_cases` 独立从 `current` 指定的已保存授权开始，使用 `candidate` 指定的新授权；引用均按 `grants.label` 查找。提供 `candidate_overrides` 时仅替换指定根字段，不重新签署；提供 `candidate_network_context` 或 `current_valid_devices` 时，仅覆盖该项对应测试输入。

`invalid_null_*` 授权的签名有效，但根部未知字段、嵌套属性或数组元素含未被允许的 `null`；对应选择用例必须因字段规则拒绝，保留已有授权。

授权选择用例的 `replace` 表示完整采用新授权，`keep` 表示丢弃正文不同且期限较短或相同的新授权，`merge` 表示同正文按设备 ID 合并有效签名，`invalid` 表示新授权未通过验证，`out_of_scope` 表示不属于同一可信网络上下文和有方向账户对。

合并时同设备的两份签名均有效则保留已有签名，并继续添加本地缺少的设备有效签名；无效签名不能覆盖已有有效签名。`keep`、`invalid` 和 `out_of_scope` 均保留已有授权。

所有用例均须按 `expected_selected` 比对引用的完整正文和签名映射，键的顺序不作为合并结果要求。跨范围用例只断言不能替换当前授权。

A1 和 A2 使用相同签名密钥、不同加密公钥及设备 ID；用例验证签名可改用当前有效的同密钥设备 ID，以及不同签名密钥和账户不能复用该签名。`inactive_signer_cannot_renew` 仍要求拒绝原映射键引用的非当前设备 ID，不自动改用其他设备。联系人记录版本、tombstone、投递授权和关系建立仍须按[联系人与授权流程](../client-relay/concepts/contacts.md)另行验证。

#### 授权格式

`grants.format_cases` 的 `input_json` 是完整授权的原始 JSON 文本；必须先按通用 JSON 规则检查重复键，再检查必需字段及签名映射的非空、设备 ID 和签名编码格式，与 `expected` 的 `accept` 或 `reject` 比对。`accept` 只表示格式通过，不代替设备授权、期限或验签。

重复设备键用例必须直接解析原始文本，不能预先转换为会覆盖重复键的映射；同值、首值有效和末值有效的重复键均须拒绝。其他用例覆盖数组、缺失或空映射、非法键、条目对象、非字符串值及非规范签名编码。

### 邀请

`unsupported_friend_invite` 只用于验证旧类型拒绝，不是允许的邀请类型。

每项 `verification_cases` 独立复制 `invite` 指定的对象，仅替换 `invite_overrides` 指定的根字段，保留原签名；提供 `network_context` 时覆盖该项的可信网络上下文。

删除根 `device_signature`、加入可信 `$context` 后重建 Canonical JSON bytes，独立验证 `expected_signature_valid`；按完整 `$type` 是否等于 `meshline.contact.invite` 验证 `expected_type_supported`。不得把旧类型改写为新类型后验签，也不得仅因签名有效而接受旧类型。

上述两项均通过仅表示签名和类型检查通过。邀请账户绑定、有效期、签署设备当前有效性及投递授权仍须按 [`ContactInvite`](../client-relay/concepts/contacts.md#contactinvite) 验证。
