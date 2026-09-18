# 群组测试向量执行说明

[规范测试向量](README.md) · [通用执行规则](README.md#通用执行规则)

## 覆盖范围

文件：[`groups-v1.json`](../../test-vectors/groups-v1.json)。章节为 `group_id`、`keying`、`management_chain` 和 `encrypted_nicknames`；各章节中的群 ID 按其自身输入解释。

| 章节 | 执行入口 |
|---|---|
| `group_id`、`keying` | [群 ID 与密码学](#群-id-与密码学) |
| `management_chain` | [管理链](#管理链)、[证书与账户绑定](#证书与账户绑定)、[并发、状态变更与可见性](#并发状态变更与可见性) |
| `encrypted_nicknames` | [加密昵称与本地状态](#加密昵称与本地状态) |

## 固定输入与引用

### 管理链输入

`management_chain` 提供三个测试账户的证书、直接携带 `account` 和公钥的申请和重置请求、覆盖 12 类操作的 15 项签名管理链事件、精确签名及哈希输入、逐项成员投影和同步响应。`chain` 按群时间线顺序排列，另含一项不参与管理链的加密昵称消息，共 16 项。

该组使用自身的 `group_id` 与账户，不套用 `keying.input`；证书账户签名遵循 RFC 6979。

### 昵称消息与分支起点

`encrypted_nicknames` 提供加密昵称消息、本地昵称状态断言及显示名示例。`epoch_inputs` 给出各密钥版本的 `client_group_secret`、`relay_epoch_secret` 及派生结果，按版本选择。

`messages` 从 `starting_event_index` 的管理状态独立开始，提供精确明文 bytes、AAD、32-byte `message_key` 派生结果、固定测试输入 `message_nonce`、信封签名输入及完整消息事件。

`main_chain_nickname` 同时出现在 `management_chain.chain[14]`，其他消息属于独立分支，不把它们追加到完整主链之后。`keying` 中的普通聊天密码学向量保持独立。

消息 `actor` 使用 `management_chain.actors` 的测试密钥；`A2` 使用 `additional_device` 指定的 A 签名密钥、`management_chain.signer_account_binding.cases` 中的 `same_account` 证书及由该证书派生的设备 ID。两个设备拥有同一账户但设备身份不同。

本专题的事件索引从 0 开始。按名称、账户标签或事件索引关联的用例沿用各自规则；这些关联不作为 JSON Pointer 展开。

## 执行步骤与断言

### 群 ID 与密码学

`group_id` 从给定网络上下文和 ID 输入重建 Canonical JSON 与 SHA-256，取摘要前 16 bytes 加 `grp_` 前缀；所有中间值和最终 ID 均须比对。

`keying` 中的承诺、盒、群应用秘密、群消息上下文和密文都是精确协议 bytes；实现必须验证网络、群、账户、成员公钥、设备、密钥版本和发送者上下文绑定。

群消息向量统一使用信封内的 `payload: { alg, nonce, ciphertext }`，算法为 `AES-256-GCM`。`keying.input.message_nonce` 和各消息用例的 `message_nonce` 是固定的随机输入，用于复算确定性的密文和签名，不从 HKDF 输出取得。

消息密钥只派生 32 bytes，分别与 `keying.expected.message_key` 或用例的 `message_key` 比对；线上 nonce 取自 `payload.nonce`。所有普通聊天、昵称和附件引用消息都使用这一构造。

### 管理链

#### 事件链与摘要

创建正文不携带 `prev_hash`，后续管理正文引用上一管理事件摘要；创建事件只能作为链起点。管理摘要直接使用完整 `payload`，包含正文签名和未知属性，采用协议统一的 `sha256:` 加 base64url 表示。

加密昵称消息的信封不携带 `prev_hash`，向量提供精确信封签名输入和 `management_head_hash_before_and_after`，不提供该事件的管理摘要；其 `expected_projection.head` 保持不变，后续关闭事件直接引用上一管理事件。

`automatic_rotation` 的正文只含 `$type`，所属群取自同步上下文，密钥版本取自外层事件，且不推进管理链。

`hash_metadata_exclusion` 验证外层设备引用、序号、接收时间和密钥版本不改变管理摘要；哈希相同不免除证书、签名、权限及其他字段校验。

建群 owner、入群申请及批准项均不携带 `nickname`；管理成员投影不保存昵称，解密后的昵称更新只改变接收方本地显示。

其他客户端验证批准者及前序权限后采用批准结果，批准事件不附申请者证书或独立公钥声明。

#### 拒绝用例

`rejection_cases` 的 `mutation` 明确给出要执行的篡改或错配，验证应失败。

### 证书与账户绑定

本节用例位于 `management_chain`。

#### 同步响应证书集合

`sync_certificate_cases` 独立验证响应证书集合，默认使用 `sync_response.events`，`empty_page: true` 时使用空事件数组。`certificate_actors` 按顺序引用 `actors` 中对应标签的证书；`invalidate_device_signature_of` 指定将该证书设备签名解码后的首 byte 异或 `1`，再按原格式编码。

验证每份证书的双重签名和身份绑定，拒绝派生设备 ID 重复，并确认全部事件引用均可解析。额外有效证书（包括空页携带的证书）不使集合无效；缺失、重复或额外无效证书仍须拒绝。`expected_certificate_set_valid` 仅断言证书集合校验结果，不代替事件及权限验证。

#### 事件签署账户

`signer_account_binding.event_index` 指向 `chain` 中的离群事件（从 0 开始）。各 `cases` 只替换该事件的 `signer_device_id` 并使用所附证书；这些证书使用同一签名公钥，正文签名和 `expected_management_hash` 均保持有效。同账户证书产生相同成员结果；证书账户与正文 `account` 不符时必须拒绝，结果须与 `expected_accepted` 比对。

#### 申请与重置请求账户

`member_request_account_binding` 对 `requests` 中的入群申请和成员密钥重置请求分别应用全部 `cases`。`certificate_source = actor_A` 使用 `actors` 中 A 的证书，另外两个值使用 `signer_account_binding.cases` 的同名证书。提供 `request_account` 时，仅替换请求的 `account`，保留原签名；否则保持完整请求不变。

`expected_signature_valid` 独立断言完整请求验签结果，`expected_account_binding_valid` 独立断言请求账户、证书账户和 `session_account` 三者相同；两项均为真才通过这两项检查。签名有效但账户绑定失败，以及账户绑定一致但篡改导致签名失败，均必须拒绝。

该组只覆盖签名与账户绑定，会话有效性、设备身份、成员资格、邀请及请求生命周期仍须另行验证。

### 并发、状态变更与可见性

本节用例位于 `management_chain`。

#### 并发与同值更新

`concurrency` 给出同一链头的两个签名更新：先接受 `first` 后，`conflicting` 必须返回 `state_conflict`，核对新状态后重新签署的 `retry` 可以继续。

`same_value_updates` 从 `starting_event_index` 指定的链状态（从 0 开始）分别应用各项 `cases`：属性值或角色保持相同时，仍接受事件并推进至 `expected_hash`，业务投影见 `expected_projection`。未知属性保留在签名正文中，不改变业务投影。原请求再次提交或其他引用旧链头的更新必须被拒绝。

#### 所有权往返与重放

`ownership_round_trip` 从 `starting_event_index` 指定的状态分别验证 A 向 B、B 向 A 的两项签名转让及投影。随后再次提交原 `replay_event`：A 已恢复 owner 权限，但请求仍引用转让前的 `prev_hash`，必须返回 `expected_replay_error` 指定的 `state_conflict`，保持状态和链头不变。

#### 封禁与成员变更

`ban_transitions` 从 `starting_event_index` 指定的链状态（从 0 开始）分别应用各项 `cases` 中的 `steps`，验证封禁同时移除当前成员、混合批次只建立一个新密钥版本、仅封禁非成员不推进密钥，以及解除封禁不恢复成员资格。

每步的 `expected_projection` 是成员与封禁投影，`expected_removed_accounts` 列出被移除账户；密钥版本由事件外层的 `epoch` 表达。主链中的重新批准使用新成员公钥并建立普通成员身份。

#### 读取可见性

`visibility` 是筛选用例，不是传输对象：区间采用包含边界的 `[start,end]`，`null` 表示无结束位置。`kind` 为 `management` 的事件均可读，消息（包括加密昵称更新）还须处于授权区间且仍保留；新设备起点由“建立时的时间线头之后”换算。当前无读取权时，必须在筛选前拒绝。

瞬时邀请、会话、暂存盒、消息密码学，以及协议要求的原子生效与故障恢复行为，仍须由各实现另行验证。

### 加密昵称与本地状态

本节用例位于 `encrypted_nicknames`。

#### 消息业务类型与昵称字段

`expected_business_valid` 为 `true` 或 `false` 时分别断言昵称结构合法或非法，为 `null` 时表示未知业务类型，不得据此改变昵称。`unknown_attributes` 验证正文中的账户、群和角色属性不能覆盖已认证上下文或成员管理字段。

`encrypted_nicknames.field_cases` 对 `administrator_set.plaintext.nickname` 逐项替换，`omit: true` 删除该字段。`expected_valid` 仅断言客户端业务校验，`null` 清除合法；拒绝明文不要求中继返回错误。

需要封装这些变体时，为每个变体分配不同消息 ID，再重新加密和签署，不能复用同一消息的 key/nonce。覆盖公共空白集合全部码点、UTF-8 长度边界、首尾空白和 Unicode 原样保留。

#### 消息认证

`authentication_cases` 使用指定消息，独立断言信封验签和 AEAD 的结果，实际接收在任一认证失败时拒绝。`flip_ciphertext_byte` 对 `payload.ciphertext` 解码后的首字节异或 1，`flip_nonce_byte` 对 `payload.nonce` 解码后的首字节异或 1；`replace_group_id` 将信封及 AAD 的群改为 `keying.input.group_id`；`replace_network_context` 将可信网络中的 magic 增加 1。

证书替换保留原信封，重建 AAD 时使用替换证书的账户与派生设备 ID。同一签名公钥不能绕过账户或设备 AAD 绑定。

#### 本地状态与处理顺序

`local_cases` 验证本地昵称的逻辑状态，不规定客户端的存储结构或持久化方式；用例假定已完成消息认证与管理历史验证；账户标签引用 `management_chain.actors`。

`sender_membership_starts` 和 `receiver_membership_start` 是本次成员资格的管理事件序号，消息须在两者之后。

逐项比较初始断言及 `steps` 的处理结果与本地覆盖；`example_initial_display_names` 和 `example_display_names` 是界面展示示例，不作为协议一致性断言。

本地覆盖中的 `nickname: null` 表示无覆盖但保留最近应用 `sequence`，不是成员投影字段。`message` 引用上述消息名，`key_available: false` 表示本用例选择暂存待解密，不标记为已应用；再次引用时默认密钥已可用。

重复已处理消息不产生副作用，较低序号不能覆盖较高序号，`created_at` 不用于排序。

#### 本地状态变更与清理

本地步骤 `profile_update` 提供已验证账户显示名；`member_leave` 清除该成员，`member_join` 的 `sequence` 建立本次成员资格。管理事件索引只提供相应历史证据，不能代替消息访问授权。

`prune_messages` 保留本地覆盖，`clear_local_data` 清除它；仅有 `management_event_index` 的步骤不改变昵称（包括解除封禁、角色、密钥或秘密变更）。

用例覆盖延迟解密、清除、重新发布、多设备并发、重名、跨群独立、账户资料变化不改写昵称、历史缺失、裁剪以及成员重新入群。

#### 重试与幂等

`retry_cases` 假定仍处于普通消息幂等保留期且当前权限有效，验证原样重试返回原序号、后续改名后重试旧消息不回退、主动重发同值产生新事件。

`change_created_at_and_resign` 将原信封 `created_at` 增加 1 并重新签署，保留消息 ID，其重复提交返回 `state_conflict`；中继不解密业务内容。

`new_nonce_same_message_id` 的 `retry_envelope` 使用新随机 nonce 重新加密并签署，明文不变、签名和 AEAD 均有效，但完整信封与原请求不同，仍返回 `state_conflict`。

#### 管理变更与昵称保留

`management_preservation` 从给定管理状态先处理 `nickname_message` 再依次处理 `steps`，断言管理投影与 `expected_local_nickname`，覆盖角色、成员密钥重置、秘密轮换和所有权转让保留昵称。

#### 历史遗漏

`history_omission` 删去主链中指定消息后仍能验证至关闭摘要，但本地昵称为空。
