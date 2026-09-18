# 群组准入方法

[群组托管协议](../README.md) · [方法公共约定](conventions.md)

## `group.invite.create`

当前成员按[群邀请策略](../core-objects.md#groupstate)创建定向或公开邀请。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/group/invite/create` |
| 会话要求 | 设备会话 |
| WSS | `group.invite.create` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

`GroupInvite` 字段：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.invite` |
| `invite_id` | string | 是 | 邀请的标识；签发设备必须为每份新邀请生成新的 16-byte 随机 ID，编码为 `inv_` 加 22 个 base64url 字符 |
| `group_id` | string | 是 | 邀请允许申请加入的群 ID；必须是当前中继托管且调用账户当前有权签发邀请的群 |
| `inviter` | string | 是 | 创建并对邀请负责的当前成员账户；必须同时等于调用账户和签名设备证书中的账户 |
| `invitee` | string | 否 | 可以使用该邀请提交申请的账户 ID；出现时为定向邀请，省略时为可分享给多个账户的公开邀请 |
| `max_uses` | integer | 否 | 公开邀请的使用上限，必须为正；省略表示到期或撤销前不限制。定向邀请必须省略此字段，且只能成功使用一次 |
| `created_at` | integer | 是 | 签发设备创建并签署邀请的 UTC Unix 秒；中继接受时按自身的时钟容错策略验证 |
| `expires_at` | integer | 是 | 邀请失效的 UTC Unix 秒；必须晚于 `created_at`，且 `expires_at - created_at` 不得超过中继 `max_group_invite_ttl` |
| `device_signature` | string | 是 | 由邀请人使用本次调用设备签署，签名输入是排除本字段后的完整邀请对象 |

### 响应对象

无。

### 处理与错误

创建时，验证群仍在存续、调用账户的当前角色和邀请策略允许所请求的定向或公开形式、`inviter` 与设备会话及验签证书中的账户一致、客户端时间符合容错策略、邀请尚未到期且签名有效。

请求结构、ID、账户编码、`max_uses`、时间字段的类型或表示、邀请声明的有效期不合法，或者邀请已经到期时返回 `bad_request`；`created_at` 超出中继允许的时钟偏差时返回 `clock_skew`；`inviter` 与设备会话或验签证书账户不一致，或者成员资格、角色、封禁状态或邀请策略不允许时返回 `forbidden`；群已关闭、邀请 ID 已存在或并发创建冲突时返回 `state_conflict`。

成功时持久化完整邀请及接受时验证的签发设备证书，不追加群事件、不推进密钥。证书后来续期、到期或设备被移除，不改变邀请接受时已经完成的授权判断。后续调低 `max_group_invite_ttl` 不改变已接受邀请的 `expires_at`。

## `group.invite.resolve`

按邀请 ID 查询一份入群邀请及其当前使用次数。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/group/invite/resolve` |
| 会话要求 | 设备会话 |
| WSS | `group.invite.resolve` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 邀请所属的群 ID |
| `invite_id` | string | 是 | 要查询的邀请 ID |

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `invite` | [GroupInvite](#groupinvitecreate) | 是 | 中继接受的完整签名邀请；`group_id` 和 `invite_id` 必须与请求相同 |
| `signer_certificate` | DeviceCertificate | 是 | 用于验证邀请对象签名的设备证书；证书账户必须等于邀请中的 `inviter` |
| `uses` | integer | 是 | 本次查询时该邀请已被成功使用的次数，必须为非负安全整数 |

客户端必须按 [`DeviceCertificate`](../../core-objects/accounts-and-devices.md#devicecertificate) 的规则验证 `signer_certificate` 的签名和身份绑定，并使用其中的签名公钥验证完整邀请。

### 处理与错误

调用账户必须是当前未被封禁的成员。owner 和 administrator 可以查询群内全部邀请；普通成员只能查询自己创建的邀请。中继必须先确认调用账户的读取权限，再返回邀请记录。

群 ID 或邀请 ID 缺失、格式非法时返回 `bad_request`；群或邀请不存在，或者邀请已经用尽、到期或被撤销时返回 `not_found`；调用账户不是当前成员、已被封禁或没有目标邀请的读取权限时返回 `forbidden`。

## `group.invite.list`

分页列出当前有效的入群邀请。owner 和 administrator 可以查看全群范围内的邀请；普通成员只能查看自己创建的邀请。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/group/invite/list` |
| 会话要求 | 设备会话 |
| WSS | `group.invite.list` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 要列出邀请记录的群 ID |
| `cursor` | string | 否 | 上一页返回的列表游标；首次读取省略，使用规则见[列表分页规则](conventions.md#列表分页规则) |
| `limit` | integer | 否 | 本页最多返回的邀请数；必须为正安全整数，遵循[分页约定](../../methods/conventions.md#分页) |

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `invites` | array&lt;object&gt; | 是 | 调用账户可见的本页邀请记录；没有可见邀请时为空数组 |
| `certificates` | array&lt;DeviceCertificate&gt; | 是 | 本页各 `signer_device_id` 引用的签发设备证书；按派生设备 ID 去重 |
| `next` | string | 否 | 本次遍历仍有记录未返回时提供；使用规则见[列表分页规则](conventions.md#列表分页规则) |

每个 `invites` 元素包含：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `invite` | [GroupInvite](#groupinvitecreate) | 是 | 中继接受的完整签名邀请 |
| `signer_device_id` | string | 是 | 创建邀请时所使用的设备 ID；必须引用本响应 `certificates` 中的一项 |
| `uses` | integer | 是 | 该邀请已被成功使用的次数，必须为非负安全整数 |

客户端必须按 [`DeviceCertificate`](../../core-objects/accounts-and-devices.md#devicecertificate) 的规则验证每份证书的签名和身份绑定，并派生设备 ID；派生结果不得重复，所得 ID 集合必须覆盖本页引用集合。客户端必须确认相应证书属于邀请中声明的邀请人账户，并用其签名公钥验证邀请。`certificates` 数组顺序没有协议语义。

### 处理与错误

列表在调用账户可见范围内排除已经用尽、到期或被撤销的邀请。

请求或游标非法时返回 `bad_request`；群不存在或游标依赖的状态已不可取得时返回 `not_found`；调用账户不是当前成员或已被封禁时返回 `forbidden`。

## `group.invite.revoke`

owner 可以撤销任何邀请；其他当前成员只能撤销自己创建的邀请。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/group/invite/revoke` |
| 会话要求 | 设备会话 |
| WSS | `group.invite.revoke` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 要撤销邀请所属的群 ID；调用账户必须仍是该群当前成员 |
| `invite_id` | string | 是 | 要撤销的邀请 ID；必须指向该群中当前仍保存的邀请记录 |

### 响应对象

无。

### 处理与错误

邀请 ID 或群 ID 非法时返回 `bad_request`；群或邀请不存在时返回 `not_found`；调用账户不是当前成员、既不是 owner 也不是邀请签发者，或者已被封禁时返回 `forbidden`；邀请已经撤销时再次调用返回 `state_conflict`。

撤销后，邀请及引用它的待审批申请立即失效，不得再接受使用该邀请的新申请或批准关联申请；已经批准的成员和已经消费的使用次数保持不变。撤销和申请失效都不进入时间线。待审批列表发生变化时发送 `group.application.changed`。

## `group.application.submit`

尚不是当前成员的账户使用有效邀请提交入群申请。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/group/application/submit` |
| 会话要求 | 设备会话 |
| WSS | `group.application.submit` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

`GroupApplication` 字段：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.application` |
| `account` | string | 是 | 申请账户；必须与本次设备会话账户及验签设备证书的账户一致 |
| `group_id` | string | 是 | 申请账户希望加入的群 ID；调用账户此时必须尚不是该群的当前成员 |
| `invite_id` | string | 是 | 授权本次申请的邀请 ID；中继接受申请时必须仍有效、未撤销、未用尽并适用于申请账户 |
| `member_encryption_public_key` | string | 是 | 申请者新生成的 32-byte X25519 公钥，使用无 padding base64url |
| `device_signature` | string | 是 | 由申请者使用本次调用设备签署，签名输入是排除本字段后的完整申请 |

### 响应对象

无。

### 处理与错误

中继通过设备会话确定本次调用账户和设备，使用该设备的证书验证签名，确认申请的 `account` 与会话及证书账户一致，并验证群仍在存续、调用账户尚不是成员且未被封禁、邀请存在、未撤销、未到期、尚有使用次数并与定向账户匹配，同时验证成员公钥。

请求结构、固定值、账户或公钥编码不合法时返回 `bad_request`；申请账户与会话或验签证书账户不一致、调用账户已被封禁，或者邀请不存在、已撤销、已到期、已用尽或不适用于调用账户时返回 `forbidden`；群已关闭、账户已经是当前成员或并发替换冲突时返回 `state_conflict`。

同一账户在一个群中最多有一份待处理申请。当前申请仍有效且本次调用通过全部适用校验时，完整签名申请的 [Canonical JSON](../../../general.md#canonical-json) 相同的 HTTP 或 WebSocket 重试返回成功，保留原申请、接受时保存的设备证书及 `accepted_at`，不改变列表，也不再次触发 `group.application.changed`。不同内容的有效申请替换该账户此前的待处理申请。

建立或替换申请时，中继必须原子保存完整申请、接受时验证的设备证书和 `accepted_at`，成功持久化后发送 `group.application.changed`。提交申请不追加群事件。

邀请使用次数和申请有效期遵循[入群邀请、申请与容量限制](../concepts/membership-and-access.md#入群邀请申请与容量限制)规则。申请账户被封禁时，其待审批申请同时删除。

## `group.application.list`

当前 owner 或 administrator 分页查询待审批申请。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/group/application/list` |
| 会话要求 | 设备会话 |
| WSS | `group.application.list` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 要列出当前待审批入群申请的群 ID |
| `cursor` | string | 否 | 上一页返回的列表游标；首次读取省略，使用规则见[列表分页规则](conventions.md#列表分页规则) |
| `limit` | integer | 否 | 本页最多返回的申请数；必须为正安全整数，遵循[分页约定](../../methods/conventions.md#分页) |

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `applications` | array&lt;object&gt; | 是 | 本页待审批申请证据；没有申请时为空数组 |
| `next` | string | 否 | 本次遍历仍有记录未返回时提供；使用规则见[列表分页规则](conventions.md#列表分页规则) |

每个 `applications` 元素包含：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `application` | [GroupApplication](#groupapplicationsubmit) | 是 | 中继保存的完整签名申请 |
| `signer_certificate` | DeviceCertificate | 是 | 中继接受申请时验证并保存的完整设备证书 |
| `accepted_at` | integer | 是 | 中继接受当前申请的 UTC Unix 秒 |

### 处理与错误

列表排除其邀请已经失效的申请。

请求或游标非法时返回 `bad_request`；群不存在或游标依赖的状态已不可取得时返回 `not_found`；调用账户没有 owner 或 administrator 权限或已被封禁时返回 `forbidden`。

## `group.application.approve`

owner 或 administrator 原子批准一份或多份申请。新成员初始角色均为 `member`。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/group/application/approve` |
| 会话要求 | 设备会话 |
| WSS | `group.application.approve` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `approval` | GroupApplicationApproval | 是 | 管理员签署的完整批量准入决定；成为批准事件的 `payload` |
| `client_secret_commitment` | string | 是 | 生成本次客户端秘密盒时使用的当前客户端群秘密承诺，采用 `sha256:` 文本表示；中继必须确认批准生效时它仍是群的当前权威承诺 |
| `client_secret_boxes` | object&lt;string, GroupSecretBox&gt; | 是 | 以每个申请账户为键的客户端秘密盒；键集合必须与批准对象列出的账户完全相同，每个盒使用相应申请公钥和秘密承诺构造 |

`GroupApplicationApproval` 字段：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.application.approval` |
| `group_id` | string | 是 | 本次批量准入所属的群；所有批准项和客户端秘密盒都必须属于该群 |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `members` | array&lt;object&gt; | 是 | 本次准入的成员结果，必须非空；账户不得重复 |
| `device_signature` | string | 是 | 由批准者使用本次调用设备签署，签名输入是排除本字段后的完整批准对象 |

每个 `members` 元素包含：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | 被批准加入群的账户；中继据此取得该账户的当前申请 |
| `member_encryption_public_key` | string | 是 | 成员加入群后使用的 32-byte X25519 公钥，必须等于当前申请中的公钥 |

批准者使用 `signer_certificate` 验证证书及完整申请签名，确认 `application.account` 与证书账户一致，并核对申请中的群、邀请和成员公钥。定向邀请的 `invitee` 必须与该账户一致；批准项使用已验证请求中的账户和公钥，密钥盒使用该账户和公钥。全部验证通过后才能封装秘密。密钥盒的构造与验证遵循[客户端秘密盒](../concepts/model-and-keys.md#客户端秘密盒)规则。

### 响应对象

无。

### 处理与错误

中继必须确认请求携带的客户端秘密承诺仍是群的当前权威承诺，并按批准对象列出的每个账户取得当前申请，确认目标账户、申请的 `account` 与申请设备证书账户一致，且成员加密公钥与当前申请一致。中继必须验证保存的申请设备证书和完整申请签名，并使用申请中的 `invite_id` 查找当前邀请，验证有效期、撤销状态、适用账户和剩余次数。邀请签发权限沿用创建邀请时已经完成的授权判断。

固定值、群 ID、账户、成员加密公钥、客户端秘密承诺表示、密钥盒账户集合或盒编码结构不合法，或者批次为空、账户重复时返回 `bad_request`；调用账户没有审批权限或已被封禁时返回 `forbidden`；群或任一账户的当前申请不存在时返回 `not_found`；群已关闭、外层客户端秘密承诺已不是当前值、容量不足、签署的成员公钥与当前申请不一致、账户已加入或被封禁、申请所用邀请已经到期、撤销或无可用次数，或者并发提交冲突时返回 `state_conflict`。

再次提交同一批准请求时，通过权限校验但引用旧链头返回 `state_conflict`；依据当前链头重新签署，但目标已无当前申请时返回 `not_found`。

中继原子消费邀请次数、删除申请、增加成员、为申请设备建立访问区间、生成新中继秘密、推进一次 `epoch` 并追加一个事件。批准成功时把已批准的账户和公钥写入内部成员状态，永久保留批准事件及批准者设备证书。其他客户端从批准者签署的结果重建成员状态。

提交成功后发送 `group.timeline.changed`，并发送 `group.application.changed` 提示待审批列表变化。

## `group.application.reject`

owner 或 administrator 拒绝一份或多份入群申请。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/group/application/reject` |
| 会话要求 | 设备会话 |
| WSS | `group.application.reject` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 入群申请所属的群 ID |
| `accounts` | array&lt;string&gt; | 是 | 要拒绝其当前入群申请的账户 ID，必须非空且不得重复 |

### 响应对象

无。

### 处理与错误

请求字段或账户格式非法、数组为空或账户重复时返回 `bad_request`；群或任一目标账户的当前申请不存在时返回 `not_found`；调用账户没有 owner 或 administrator 权限或已被封禁时返回 `forbidden`；中继读取本批当前申请后，若任一记录在本次操作提交前被并发替换或处理，返回 `state_conflict`。

全部校验通过后，原子删除全部目标账户在操作生效时的当前待审批申请，不消费邀请次数、不追加群事件，并在提交后发送 `group.application.changed`。任一校验失败时整批不生效。
