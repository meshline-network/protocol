# 成员密钥重置方法

[群组托管协议](../README.md) · [方法公共约定](conventions.md)

## `group.member.recovery.submit`

当前成员用有效设备发起成员密钥重置，以替换自己的成员加密公钥。请求不改变群状态，并在有限期限内等待批准。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/group/member/recovery/submit` |
| 会话要求 | 设备会话 |
| WSS | `group.member.recovery.submit` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

`GroupMemberRecoveryRequest` 字段：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.member.recovery` |
| `account` | string | 是 | 请求重置成员公钥的账户；必须与本次设备会话账户及验签设备证书的账户一致 |
| `group_id` | string | 是 | 当前成员要重置成员加密公钥的群 ID |
| `member_encryption_public_key` | string | 是 | 新的 32-byte X25519 公钥，使用无 padding base64url，必须不同于当前成员公钥 |
| `device_signature` | string | 是 | 由发起成员密钥重置的成员使用本次调用设备签署，签名输入是排除本字段后的完整请求 |

建议客户端在提交请求前保存完整请求和候选私钥，以便中断后继续处理；候选材料不覆盖当前私有状态。替换请求时，必须继续持有与新请求公钥对应的私钥。

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `accepted_at` | integer | 是 | 中继接受当前请求的 UTC Unix 秒 |
| `expires_at` | integer | 是 | 当前请求失效的 UTC Unix 秒；必须晚于 `accepted_at` |

### 处理与错误

中继使用本次调用设备的证书验证完整请求签名，并确认请求的 `account` 与会话及证书账户一致。

请求结构、固定值、账户或公钥编码非法，或者新公钥与当前成员公钥相同时返回 `bad_request`；群不存在时返回 `not_found`；请求账户与会话或验签证书账户不一致、调用账户不是当前成员或已被封禁时返回 `forbidden`；成员状态在并发处理中已经变化时返回 `state_conflict`。

每个群中的当前成员账户最多保留一份密钥重置请求。当前请求仍有效且本次调用通过全部适用校验时，完整签名请求的 [Canonical JSON](../../../general.md#canonical-json) 相同的 HTTP 或 WebSocket 重试返回成功，不刷新接受时间和到期时间，也不再次触发通知；不同内容的有效请求替换此前尚未处理的请求。

建立或替换请求时，中继原子保存当前请求、验证签名所用设备证书、`accepted_at` 和 `expires_at`。本次有限的等待期限由中继在接受时确定；后续配置变化和相同请求重试均不得改变已保存的到期时间。成功持久化后发送 `group.member.recovery.changed`。

提交、替换、撤回或过期均不改变当前成员公钥。替换不保留旧请求，也不改变访问区间、时间线或密钥版本。成员离开、被移除或者请求获批时，中继必须删除其当前请求。

## `group.member.recovery.list`

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/group/member/recovery/list` |
| 会话要求 | 设备会话 |
| WSS | `group.member.recovery.list` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 要读取待审批成员密钥重置请求的群 ID |
| `cursor` | string | 否 | 上一页返回的列表游标；首次读取省略，使用规则见[列表分页规则](conventions.md#列表分页规则) |
| `limit` | integer | 否 | 本页最多返回的请求数；必须为正安全整数，遵循[分页约定](../../methods/conventions.md#分页) |

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `requests` | array&lt;object&gt; | 是 | 调用账户可见的本页待审批请求；没有可见请求时为空数组 |
| `next` | string | 否 | 本次遍历仍有记录未返回时提供；使用规则见[列表分页规则](conventions.md#列表分页规则) |

每个 `requests` 元素包含：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `request` | [GroupMemberRecoveryRequest](#groupmemberrecoverysubmit) | 是 | 中继保存的完整签名成员密钥重置请求 |
| `signer_certificate` | DeviceCertificate | 是 | 中继接受请求时验证并保存的完整设备证书 |
| `accepted_at` | integer | 是 | 中继接受当前请求的 UTC Unix 秒 |
| `expires_at` | integer | 是 | 当前请求失效的 UTC Unix 秒，必须晚于 `accepted_at`；到达该时间后请求不得再被批准、拒绝或撤回 |

客户端必须按 [`DeviceCertificate`](../../core-objects/accounts-and-devices.md#devicecertificate) 的签名与身份规则验证每条记录中的 `signer_certificate`，再用它验证 `request` 的网络绑定签名，并确认 `request.account` 与证书账户一致。证书只证明中继接受请求时使用的签名身份；客户端不根据证书当前是否仍然有效来重新判断这份历史请求能否被列出，批准或拒绝时由中继重新校验当前请求、成员状态和调用权限。

### 处理与错误

owner 可以看到全部当前请求；administrator 可以看到普通 member 的请求和自己的请求；普通 member 只看到自己的请求。普通成员的结果至多一项，因此不得返回 `next`。

列表只包含调用账户可见且尚未过期的请求。

请求或游标非法时返回 `bad_request`；群不存在或游标依赖的状态已不可取得时返回 `not_found`；调用账户不是当前成员或已被封禁时返回 `forbidden`。

本地保存的请求不再列出时，客户端同步并验证管理链，从批准结果重建当前成员公钥。只有同时满足以下条件，才能启用候选私钥：

1. 存在账户和新公钥均与候选一致的批准事件；
2. 当前成员状态仍使用该公钥；
3. 客户端秘密盒与已验证的当前承诺一致。

批准管理事件及验签证书永久保留；缺失时补取管理历史，不能以中继报告的公钥代替批准核验。

请求被替换、拒绝或过期且未获相应批准时，丢弃候选。

密钥盒验证失败时不得启用候选私钥，成员可以重新提交密钥重置请求。

## `group.member.recovery.approve`

本方法批准一份或多份当前成员密钥重置请求。owner 或 administrator 为每名目标成员提供客户端秘密盒。

owner 可以批准包括自己在内的任意当前成员；administrator 只能批准普通成员，不能批准自己的请求。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/group/member/recovery/approve` |
| 会话要求 | 设备会话 |
| WSS | `group.member.recovery.approve` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `approval` | GroupMemberRecoveryApproval | 是 | 有权批准目标请求的成员签署的完整批量批准决定；成为批准事件的 `payload` |
| `client_secret_commitment` | string | 是 | 生成本次客户端秘密盒时使用的当前客户端群秘密承诺，采用 `sha256:` 文本表示；中继必须确认批准生效时它仍是群的当前权威承诺 |
| `client_secret_boxes` | object&lt;string, GroupSecretBox&gt; | 是 | 以每个目标账户为键的客户端秘密盒；键集合必须与批准对象列出的账户完全相同，每个盒使用对应当前请求中的新成员公钥构造 |

`GroupMemberRecoveryApproval` 字段：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.member.recovery.approval` |
| `group_id` | string | 是 | 本次成员密钥重置所属的群；所有批准结果和客户端秘密盒都必须属于该群 |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `members` | array&lt;object&gt; | 是 | 本次批准的成员密钥重置结果，必须非空；账户不得重复 |
| `device_signature` | string | 是 | 批准者使用本次调用设备签署，签名输入是排除本字段后的完整批准对象 |

每个 `members` 元素包含：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `account` | string | 是 | 要重置成员加密公钥的当前成员账户；中继据此取得该账户的当前请求 |
| `member_encryption_public_key` | string | 是 | 批准启用的 32-byte X25519 公钥，使用无 padding base64url；必须等于该账户当前请求中的新成员公钥 |

批准者必须按 [`group.member.recovery.list`](#groupmemberrecoverylist) 的规则取得并逐项验证请求，确认请求的 `account` 对应目标成员且自己具有批准权限，再使用请求中的 `member_encryption_public_key`，按[客户端秘密盒](../concepts/model-and-keys.md#客户端秘密盒)规则封装秘密。

### 响应对象

无。

### 处理与错误

中继按每个目标账户取得操作生效时的当前待审批请求，确认目标账户、请求的 `account` 与请求设备证书账户一致，仅在每项批准结果均与对应请求一致时接受整批批准。

固定值、群 ID、账户、账户集合、新成员公钥、承诺表示或盒编码结构不合法，或者批次为空、账户重复时返回 `bad_request`；调用账户没有批准权限、已被封禁，或者 administrator 试图批准非普通成员或自己的请求时返回 `forbidden`；群或任一账户的当前请求不存在，或者请求已经过期时返回 `not_found`；群已关闭、批准中的新成员公钥与当前请求不一致、请求携带的承诺不再是群的当前权威承诺、目标不再是当前成员，或者发生并发状态变化时返回 `state_conflict`。

中继必须先验证整批请求、证书、批准权限、成员状态、客户端秘密承诺和盒编码，再原子替换全部目标成员公钥，关闭各目标账户的旧设备访问区间，允许中继接受相应请求时记录的设备从本事件开始访问，保存各自的客户端秘密盒，删除全部已批准请求，生成一份新中继秘密，推进一次 `epoch`，并以完整 `GroupMemberRecoveryApproval` 追加一个事件。存在客户端秘密轮换准备时，必须在同一次原子提交中按 [`group.secret.rotation.prepare`](keys.md#groupsecretrotationprepare) 的规则删除本批目标成员的暂存盒，保留其余盒和原到期时间。

相关状态成功持久化后发送一次 `group.timeline.changed`，并发送 `group.member.recovery.changed` 提示相关请求已经变化。

## `group.member.recovery.reject`

本方法删除同一群的一份或多份当前待审批的成员密钥重置请求。逐项判断权限：请求属于调用账户时表示撤回自己的请求；owner 可以拒绝其他成员的请求，administrator 只能拒绝其他普通成员的请求。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/group/member/recovery/reject` |
| 会话要求 | 设备会话 |
| WSS | `group.member.recovery.reject` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 成员密钥重置请求所属的群 ID |
| `accounts` | array&lt;string&gt; | 是 | 要撤回或拒绝其当前成员密钥重置请求的账户 ID，必须非空且不得重复 |

### 响应对象

无。

### 处理与错误

请求字段或账户格式非法、数组为空或账户重复时返回 `bad_request`；群或任一目标账户的当前请求不存在，或者任一请求已经过期时返回 `not_found`；调用账户不是当前成员、已被封禁，或者存在无权撤回或拒绝的目标请求时返回 `forbidden`；中继读取本批当前请求后，若任一记录在本次操作提交前被并发替换或处理，返回 `state_conflict`。

全部校验通过后，原子删除全部目标账户的待审批记录，不改变成员、公钥、访问区间、密钥或时间线。任一校验失败时整批不生效。提交后发送 `group.member.recovery.changed`。成员以后可以直接提交新的有效请求。
