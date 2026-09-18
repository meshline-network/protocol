# 群组托管协议

[客户端—中继协议](../README.md)

群组托管是客户端—中继协议的可选模块。群由用户创建并选择一个固定中继托管；客户端直接连接该中继，群组操作不经过账户路由 DHT 或中继 RPC。提供该能力的中继必须完整实现本模块，并在有效 `RelayDescriptor` 中声明 `group.host.v1` 能力。

## 作用与信任边界

托管中继验证设备、成员和角色，维护当前群状态，为事件和密钥版本排序，并向有权访问的设备分发中继秘密。当前成员共同持有客户端群秘密。群消息密钥必须同时由客户端秘密和中继秘密导出，因此中继单独不能解密群消息。

客户端通过永久保留的[管理链](core-objects.md#客户端验证与恢复)验证成员和公钥。成员列表由客户端本地重建；封装秘密前必须完成管理验证。

中继与持有客户端秘密的一方串谋时可能解密相应消息；本协议不声明前向保密或入侵后安全性质。串谋、秘密泄露及秘密轮换的详细限制见[安全边界](concepts/model-and-keys.md#安全边界)。

## 协议内容

### 概念与核心对象

| 部分 | 内容 |
|---|---|
| [群组模型与密钥](concepts/model-and-keys.md) | 固定托管、角色、分离秘密、承诺、密钥盒和群应用秘密派生 |
| [成员资格与访问控制](concepts/membership-and-access.md) | 邀请、申请、成员变化、成员密钥重置、设备访问区间 |
| [群组时间线与同步](concepts/timeline-and-sync.md) | 群时间线、数据保留与访问、首次加载与断线恢复 |
| [账户内群状态与秘密同步](concepts/account-sync.md) | 同账户设备之间的群私有状态请求、成员私钥及历史群应用秘密同步 |
| [群消息与加密](concepts/messaging-and-encryption.md) | 信封、消息密钥派生与加解密、群消息业务对象、昵称更新 |
| [核心对象](core-objects.md) | 群 ID、`GroupState`、`GroupEvent` 和管理链 |

### 方法与通知

| 部分 | 内容 |
|---|---|
| [方法公共约定](methods/conventions.md) | 传输、授权、签名、列表分页、校验和错误 |
| [生命周期与同步方法](methods/lifecycle-and-sync.md) | 创建、状态查询、事件同步和关闭 |
| [准入方法](methods/admission.md) | 邀请、入群申请与审批 |
| [属性与角色管理方法](methods/properties-and-roles.md) | 群属性、角色和所有权转让 |
| [成员与封禁管理方法](methods/members-and-bans.md) | 退出、移除、封禁与解除封禁 |
| [成员密钥重置方法](methods/member-recovery.md) | 重置请求的提交、列表、批准与拒绝 |
| [密钥方法](methods/keys.md) | 密钥同步与客户端秘密轮换 |
| [消息方法](methods/messaging.md) | 群消息发送与幂等重试 |
| [订阅方法](methods/subscription.md) | 群订阅集合替换、订阅上限、访问权限校验与订阅后同步 |
| [通知](notifications/README.md) | 事件、申请和成员密钥重置列表变化提示 |

## 方法索引

以下方法均使用设备会话。

| 方法 | HTTP | WebSocket |
|---|---|---|
| [`group.create`](methods/lifecycle-and-sync.md#groupcreate) | POST | JSON-RPC |
| [`group.resolve`](methods/lifecycle-and-sync.md#groupresolve) | GET | JSON-RPC |
| [`group.sync`](methods/lifecycle-and-sync.md#groupsync) | GET | JSON-RPC |
| [`group.close`](methods/lifecycle-and-sync.md#groupclose) | DELETE | JSON-RPC |
| [`group.invite.create`](methods/admission.md#groupinvitecreate) | POST | JSON-RPC |
| [`group.invite.resolve`](methods/admission.md#groupinviteresolve) | GET | JSON-RPC |
| [`group.invite.list`](methods/admission.md#groupinvitelist) | GET | JSON-RPC |
| [`group.invite.revoke`](methods/admission.md#groupinviterevoke) | DELETE | JSON-RPC |
| [`group.application.submit`](methods/admission.md#groupapplicationsubmit) | POST | JSON-RPC |
| [`group.application.list`](methods/admission.md#groupapplicationlist) | GET | JSON-RPC |
| [`group.application.approve`](methods/admission.md#groupapplicationapprove) | POST | JSON-RPC |
| [`group.application.reject`](methods/admission.md#groupapplicationreject) | DELETE | JSON-RPC |
| [`group.update`](methods/properties-and-roles.md#groupupdate) | PATCH | JSON-RPC |
| [`group.role.update`](methods/properties-and-roles.md#grouproleupdate) | PUT | JSON-RPC |
| [`group.owner.transfer`](methods/properties-and-roles.md#groupownertransfer) | POST | JSON-RPC |
| [`group.member.leave`](methods/members-and-bans.md#groupmemberleave) | DELETE | JSON-RPC |
| [`group.member.remove`](methods/members-and-bans.md#groupmemberremove) | DELETE | JSON-RPC |
| [`group.member.ban`](methods/members-and-bans.md#groupmemberban) | PUT | JSON-RPC |
| [`group.member.unban`](methods/members-and-bans.md#groupmemberunban) | DELETE | JSON-RPC |
| [`group.member.recovery.submit`](methods/member-recovery.md#groupmemberrecoverysubmit) | POST | JSON-RPC |
| [`group.member.recovery.list`](methods/member-recovery.md#groupmemberrecoverylist) | GET | JSON-RPC |
| [`group.member.recovery.approve`](methods/member-recovery.md#groupmemberrecoveryapprove) | POST | JSON-RPC |
| [`group.member.recovery.reject`](methods/member-recovery.md#groupmemberrecoveryreject) | DELETE | JSON-RPC |
| [`group.key.sync`](methods/keys.md#groupkeysync) | GET | JSON-RPC |
| [`group.secret.rotation.prepare`](methods/keys.md#groupsecretrotationprepare) | PATCH | JSON-RPC |
| [`group.secret.rotation.commit`](methods/keys.md#groupsecretrotationcommit) | POST | JSON-RPC |
| [`group.message.send`](methods/messaging.md#groupmessagesend) | POST | JSON-RPC |
| [`group.subscribe`](methods/subscription.md#groupsubscribe) | N/A | JSON-RPC |

HTTP/WSS 映射和错误遵循[群组方法公共约定](methods/conventions.md)。

## 通知索引

- [`group.timeline.changed`](notifications/README.md#grouptimelinechanged)
- [`group.application.changed`](notifications/README.md#groupapplicationchanged)
- [`group.member.recovery.changed`](notifications/README.md#groupmemberrecoverychanged)

通知封装遵循[客户端—中继通知约定](../notifications/README.md)。

## 一致性要求

兼容实现须遵循[一致性测试边界](../../test-vectors/README.md#一致性测试边界)及[客户端方法公共约定](../methods/conventions.md)，并覆盖：

- 请求与提交：按[群方法公共约定](methods/conventions.md)验证完整请求、设备签名与账户绑定、批准者独立验签、字段与资源边界、HTTP/WSS 错误映射及错误披露边界；并发和故障不得留下部分状态、事件、密钥、访问区间或邀请计数。
- 管理状态：按[管理链](core-objects.md#管理链)和[成员资格与访问控制](concepts/membership-and-access.md)验证创建、属性与角色更新、转让、离群、移除、封禁/解除封禁、容量限制与成员投影；覆盖同值更新、旧链头重放、未知管理类型及管理验证失败后的暂停。
- 邀请与审批：按[准入方法](methods/admission.md)和[成员密钥重置方法](methods/member-recovery.md)验证邀请分享、查看及使用权限、申请重试与替换、成员密钥重置、到期和连带删除；[列表分页](methods/conventions.md#列表分页规则)须覆盖游标、空页、列表与权限变化、未变化列表的完整遍历，以及列表结果不能替代提交时的当前状态检查。
- 秘密与轮换：按[密钥模型](concepts/model-and-keys.md)及[密钥方法](methods/keys.md)验证分离秘密、承诺、两类密钥盒与派生结果、两阶段客户端轮换和中继轮换；覆盖分批与替换、迟到重试、期限不刷新、成员变化、完整覆盖、owner 换钥，以及候选材料经验证后启用。
- 密钥与私有状态恢复：按[账户内群状态与秘密同步](concepts/account-sync.md)和 [`group.key.sync`](methods/keys.md#groupkeysync) 验证材料独立到达时的暂存、按已验证历史选择私钥和确认版本、历史盒与当前盒的恢复、跨页及相邻条目的盒省略规则；缺失历史密钥不阻塞管理验证和当前版本恢复。
- 事件与访问：按[设备访问区间](concepts/membership-and-access.md#设备访问区间)及 [`group.sync`](methods/lifecycle-and-sync.md#groupsync) 验证新设备入口、边界与多段区间、管理事件和消息的不同可见范围、非连续序号及密钥版本、消息认证与管理链重建；快照、通知和私有材料不能推进已验证状态或同步位置。
- 消息与昵称：按[群消息与加密](concepts/messaging-and-encryption.md)和[幂等重试](methods/messaging.md#群消息幂等重试)验证完整信封、随机 nonce、AAD、当前权限、结果保留、正文与附件、回复引用，以及加密昵称的本地排序、清除和重新入群边界；业务明文错误与管理事件错误分别处理。
- 订阅与通知：按[订阅方法](methods/subscription.md)和[群组通知](notifications/README.md)验证集合替换、清空、上限调低、失败明细、设备访问区间保持；覆盖事件提示合并、无版本列表刷新，以及请求到期或删除后的通知。
- 保留与关闭：按[数据保留与访问规则](concepts/timeline-and-sync.md#群组数据保留与访问规则)及 [`group.close`](methods/lifecycle-and-sync.md#groupclose) 验证消息与旧密钥裁剪、当前密钥恢复、管理事件及验签证书永久保留和不可逆关闭；关闭后不保证读取服务或消息、密钥保留。
