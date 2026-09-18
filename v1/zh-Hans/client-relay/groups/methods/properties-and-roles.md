# 群属性与角色管理方法

[群组托管协议](../README.md) · [方法公共约定](conventions.md)

## `group.update`

owner 修改群名称、简介、成员容量或邀请策略。

| 项目 | 约定 |
|---|---|
| HTTP | `PATCH /meshline/v1/group/update` |
| 会话要求 | 设备会话 |
| WSS | `group.update` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.update` |
| `group_id` | string | 是 | 要修改群属性的群 ID；群必须仍处于 active 状态 |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `name` | string | 否 | 出现时替换当前群名称；必须至少包含一个非[空白字符](../../../general.md#文本空白字符)，UTF-8 编码后最多 256 bytes；省略表示名称保持不变 |
| `description` | string | 否 | 出现时替换当前简介；非空时不得仅包含[空白字符](../../../general.md#文本空白字符)且最多 4,096 UTF-8 bytes；省略表示简介保持不变 |
| `member_capacity` | integer | 否 | 出现时替换当前容量，必须为正；增加容量时不得超过中继当前 `max_group_members`，保持或降低既有容量不受后来调低的上限限制；省略表示容量保持不变 |
| `invite_policy` | string | 否 | 出现时替换成员邀请策略，取值与含义见 [`GroupState.invite_policy`](../core-objects.md#groupstate)；省略表示策略保持不变 |
| `device_signature` | string | 是 | 由当前 owner 使用本次调用设备签署，签名输入是排除本字段后的完整更新对象 |

必须至少提供一个可修改字段。新容量可以低于当前成员数；批准入群后的成员总数不得超过该容量。

本方法只修改 `name`、`description`、`member_capacity` 和 `invite_policy`。更新对象的未知属性仍参与签名，并在事件中原样保留，但不合并到 `GroupState`，也不改变成员或事件外层字段；未知属性不能代替可修改字段满足必填条件。

### 响应对象

无。

### 处理与错误

固定值、名称、简介、容量或邀请策略不合法时返回 `bad_request`；群不存在时返回 `not_found`；调用账户不是当前 owner 或已被封禁时返回 `forbidden`；并发状态冲突时返回 `state_conflict`。

校验通过后，中继以本次提供的字段更新群属性；完整更新对象作为新事件的 `payload` 追加到时间线，并更新管理链头。相关状态成功持久化后发送 `group.timeline.changed`。密钥版本不变。

## `group.role.update`

owner 设置一名当前非 owner 成员的角色。

| 项目 | 约定 |
|---|---|
| HTTP | `PUT /meshline/v1/group/role/update` |
| 会话要求 | 设备会话 |
| WSS | `group.role.update` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.role.update` |
| `group_id` | string | 是 | 目标成员所在的群 ID |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `account` | string | 是 | 要设置角色的当前非 owner 成员账户 |
| `role` | string | 是 | 目标成员更新后的角色，只能是 `administrator` 或 `member` |
| `device_signature` | string | 是 | 由当前 owner 使用本次调用设备签署，签名输入是排除本字段后的完整角色更新对象 |

### 响应对象

无。

### 处理与错误

角色值或固定字段非法时返回 `bad_request`；群不存在时返回 `not_found`；调用账户不是当前 owner 或已被封禁时返回 `forbidden`；目标不是当前非 owner 成员或发生并发成员变化时返回 `state_conflict`。

校验通过后，中继以请求指定的角色更新目标成员记录，将完整签名的角色更新对象作为新事件的 `payload` 追加到时间线，并更新管理链头。相关状态成功持久化后发送 `group.timeline.changed`。成员资格、公钥、访问区间和密钥版本不变。

## `group.owner.transfer`

当前 owner 把群组所有权转让给另一名未被封禁的当前成员。

| 项目 | 约定 |
|---|---|
| HTTP | `POST /meshline/v1/group/owner/transfer` |
| 会话要求 | 设备会话 |
| WSS | `group.owner.transfer` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.owner.transfer` |
| `group_id` | string | 是 | 要转让所有权的群 ID |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `new_owner_account` | string | 是 | 当前 owner 指定的接任账户，必须是该群另一名未被封禁的当前成员 |
| `device_signature` | string | 是 | 当前 owner 使用本次调用设备对排除本字段后的完整请求所作网络绑定签名 |

### 响应对象

无。

### 处理与错误

固定字段、`prev_hash` 或账户格式非法时返回 `bad_request`；群不存在时返回 `not_found`；调用账户不是当前 owner、目标不是另一当前成员、目标已被封禁，或者调用方已被封禁时返回 `forbidden`；通过权限校验但 `prev_hash` 已不是当前管理链头，或者发生并发成员状态冲突时返回 `state_conflict`。

操作成功时把目标成员改为 owner、原 owner 改为普通 member、更新 `owner`，追加完整签名转让事件并更新管理链头，同时删除原 owner 的暂存轮换。该操作不改变成员集合、访问区间或密钥版本。
