# 群组通知

[群组托管协议](../README.md) · [客户端—中继通知](../../notifications/README.md) · [群组订阅方法](../methods/subscription.md)

群组通知只发送给具有有效设备会话并已订阅相应群的连接。通知发送遵循[原子提交与持久化规则](../methods/conventions.md#原子提交与持久化规则)要求。通知可能乱序到达；提示的过滤、合并及补读遵循[通知处理规则](../../notifications/README.md#通知处理规则)。

首次加载或断线恢复时，客户端可以参考[群组同步与恢复流程](../concepts/timeline-and-sync.md#群组同步与恢复流程)同步群状态。订阅后的事件补同步遵循 [`group.subscribe`](../methods/subscription.md#groupsubscribe) 的规则。

## `group.timeline.changed`

群追加新事件后，中继向当前有读取权的订阅连接发送该通知。

### 通知参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 时间线发生变化的群 ID |
| `head` | integer | 是 | 中继生成通知时观察到的该群最高已分配序号 |

### 处理规则

需要补同步时，客户端从本地已完成位置调用 [`group.sync`](../methods/lifecycle-and-sync.md#groupsync) 取得事件；本地缺少所需版本的密钥材料时，按 [`group.key.sync`](../methods/keys.md#groupkeysync) 的规则补齐。

## `group.application.changed`

待审批申请列表因申请建立、替换、批准、拒绝、删除或邀请失效而发生变化时，向已订阅该群的当前 owner 和 administrator 发送。

### 通知参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 待审批申请列表发生变化的群 ID |

### 处理规则

需要更新待审批申请列表时，客户端调用 [`group.application.list`](../methods/admission.md#groupapplicationlist) 读取。

## `group.member.recovery.changed`

成员密钥重置的待审批列表因请求建立、替换、撤回、批准、拒绝、删除或到期而发生变化时，向已订阅该群的请求所属账户以及有权处理至少一项请求的当前 owner 或 administrator 发送。

成员离群、被移除、被封禁，或者 owner 在客户端秘密轮换中更换自身成员公钥时，成功提交且实际删除了待审批密钥重置请求，也必须触发本通知。接收这些删除提示的订阅连接必须仍有群访问权：当前 owner 接收；administrator 在删除前有权查看至少一项被删请求时接收；请求所属账户仍有群访问权时也接收。

### 通知参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `group_id` | string | 是 | 当前账户可见的成员密钥重置列表发生变化的群 ID |

### 处理规则

需要更新当前账户可见的待审批密钥重置请求时，客户端调用 [`group.member.recovery.list`](../methods/member-recovery.md#groupmemberrecoverylist) 读取并按该方法验证返回记录。
