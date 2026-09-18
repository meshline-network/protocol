# 群成员与封禁管理方法

[群组托管协议](../README.md) · [方法公共约定](conventions.md)

## `group.member.leave`

当前非 owner 成员立即离群。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/group/member/leave` |
| 会话要求 | 设备会话 |
| WSS | `group.member.leave` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.member.leave` |
| `group_id` | string | 是 | 调用账户要退出的群 ID |
| `account` | string | 是 | 要退出群的账户；必须与设备会话账户及签名设备证书所属账户一致 |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `device_signature` | string | 是 | 由离群成员使用本次调用设备签署，签名输入是排除本字段后的完整请求 |

### 响应对象

无。

### 处理与错误

中继核对 `account` 与设备会话账户一致，并确认操作生效时该账户仍是当前非 owner 成员且未被封禁。

固定字段或账户格式非法时返回 `bad_request`；群不存在时返回 `not_found`；`account` 与会话账户不一致、账户不是当前成员、仍是 owner 或已被封禁时返回 `forbidden`；发生并发状态冲突时返回 `state_conflict`。

再次提交相同请求时，有效会话的调用账户因不再具有成员资格而返回 `forbidden`。

操作成功时删除当前成员、关闭该账户全部设备访问区间、删除该成员的待审批密钥重置请求、生成新中继秘密、推进一次 `epoch` 并追加离群事件。存在客户端秘密轮换准备时，必须在同一次原子提交中按 [`group.secret.rotation.prepare`](keys.md#groupsecretrotationprepare) 的规则删除该成员的暂存盒，保留其余盒和原到期时间；主动离群不使准备失效。相关状态成功持久化后发送 `group.timeline.changed`；本次实际删除了待审批密钥重置请求时，还须按[删除通知的接收范围](../notifications/README.md#groupmemberrecoverychanged)发送 `group.member.recovery.changed`。

客户端验证离群事件时，必须确认 `signer_device_id` 对应的设备证书属于 `account`，验证正文签名及该账户在前序群状态中的离群权限，再按 `account` 应用离群结果。

## `group.member.remove`

owner 或 administrator 移除一名或多名成员。owner 可以移除任意非 owner；administrator 只能移除普通 member。调用账户和当前 owner 不能成为目标。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/group/member/remove` |
| 会话要求 | 设备会话 |
| WSS | `group.member.remove` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.member.removal` |
| `group_id` | string | 是 | 要移除的成员所属群 ID |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `accounts` | array&lt;string&gt; | 是 | 要移除的当前成员账户 ID，必须非空且不得重复 |
| `device_signature` | string | 是 | 由发起移除的 owner 或 administrator 使用本次调用设备签署，签名输入是排除本字段后的完整请求 |

### 响应对象

无。

### 处理与错误

固定字段非法、批次为空或账户重复时返回 `bad_request`；群不存在时返回 `not_found`；调用账户没有 owner 或 administrator 权限、已被封禁、目标是 owner 或调用账户，或者 administrator 试图移除 administrator 时返回 `forbidden`；任一目标账户不是当前成员或发生并发成员变化时返回 `state_conflict`。

中继必须先验证全部目标，再原子移除整批成员、关闭目标访问区间、清理其待审批密钥重置请求、生成一份新中继秘密、推进一次 `epoch` 并追加一个事件。存在客户端秘密轮换准备时，必须在同一次原子提交中按 [`group.secret.rotation.prepare`](keys.md#groupsecretrotationprepare) 的规则删除这些成员的暂存盒，保留其余盒和原到期时间；成员移除不使准备失效。

相关状态成功持久化后发送 `group.timeline.changed`；本次实际删除了待审批密钥重置请求时，还须按[删除通知的接收范围](../notifications/README.md#groupmemberrecoverychanged)发送 `group.member.recovery.changed`。

## `group.member.ban`

owner 可以封禁任意非 owner 账户；administrator 只能封禁普通成员或非成员。封禁将目标加入封禁集合，禁止其访问群接口和重新加入。

| 项目 | 约定 |
|---|---|
| HTTP | `PUT /meshline/v1/group/member/ban` |
| 会话要求 | 设备会话 |
| WSS | `group.member.ban` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.member.ban` |
| `group_id` | string | 是 | 要封禁账户的群 ID |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `accounts` | array&lt;string&gt; | 是 | 要封禁的账户 ID，必须非空且不得重复；可以包含当前成员、非成员和已被封禁的账户 |
| `device_signature` | string | 是 | 由发起封禁的 owner 或 administrator 使用本次调用设备签署，签名输入是排除本字段后的完整请求 |

### 响应对象

无。

### 处理与错误

#### 校验与封禁数量限制

固定值非法、数组为空、账户为空或账户重复时返回 `bad_request`；群不存在时返回 `not_found`；调用账户没有 owner 或 administrator 权限、已被封禁、目标是 owner，或者 administrator 试图封禁 administrator 时返回 `forbidden`；本次新增封禁且合并后的封禁总数将超过中继配置的封禁账户数上限，或并发状态冲突时返回 `state_conflict`。

新增封禁及合并后的总数按操作生效时的当前封禁集合计算，已被封禁的目标不重复计数。中继后来调低上限时，全部目标已被封禁的请求不因既有总数超过新上限而被拒绝，仍须满足权限、签名和管理链头等要求；含新增目标的混合批次超过上限时，整批拒绝。

#### 状态变更与事件通知

中继先验证整批目标的权限和封禁集合上限，再原子合并封禁集合、删除全部目标账户的待审批入群申请，并移除目标中的全部当前成员、关闭其所有设备访问区间、清理其待审批密钥重置请求。删除入群申请不消费邀请使用次数。只要本批移除了成员，就生成一份新中继秘密、推进一次 `epoch`；存在客户端秘密轮换准备时，必须在同一次原子提交中按 [`group.secret.rotation.prepare`](keys.md#groupsecretrotationprepare) 的规则删除实际被移除成员的暂存盒，保留其余盒和原到期时间。封禁不使准备失效。全部目标均非当前成员时，不改变成员、访问区间或密钥，暂存轮换保持不变。任一校验失败时整批不生效。

每次成功调用只追加一个完整签名的 `meshline.group.member.ban` 管理事件，不另行追加移除事件，并原子更新管理链头。

相关状态成功持久化后发送 `group.timeline.changed`；本次删除了入群申请时，还须发送 `group.application.changed`；实际删除了待审批密钥重置请求时，还须按[删除通知的接收范围](../notifications/README.md#groupmemberrecoverychanged)发送 `group.member.recovery.changed`。

客户端依据前序成员状态验证权限，同时移除目标成员并更新封禁集合。

## `group.member.unban`

owner 或 administrator 可以一次解除一个或多个账户的封禁。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/group/member/unban` |
| 会话要求 | 设备会话 |
| WSS | `group.member.unban` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.group.member.unban` |
| `group_id` | string | 是 | 要解除账户封禁的群 ID |
| `prev_hash` | string | 是 | 上一项[管理链](../core-objects.md#参与事件与前序引用)摘要；提交时必须仍是当前链头 |
| `accounts` | array&lt;string&gt; | 是 | 要从该群封禁集合移除的账户 ID，必须非空且不得重复；可以包含当前未被封禁的账户 |
| `device_signature` | string | 是 | 由发起解除封禁的 owner 或 administrator 使用本次调用设备签署，签名输入是排除本字段后的完整请求 |

### 响应对象

无。

### 处理与错误

固定值非法、数组为空、账户为空或账户重复时返回 `bad_request`；群不存在时返回 `not_found`；调用账户没有 owner 或 administrator 权限或已被封禁时返回 `forbidden`；并发状态冲突时返回 `state_conflict`。

中继原子移除请求所列现有封禁项、将完整签名请求追加为管理事件并更新管理链头。解除封禁不恢复已删除的入群申请、成员资格、原角色或已关闭的消息和密钥访问区间；重新入群遵循正常申请批准规则。成员状态和密钥版本不变，客户端通过管理链更新封禁状态。

相关状态成功持久化后发送 `group.timeline.changed`。
