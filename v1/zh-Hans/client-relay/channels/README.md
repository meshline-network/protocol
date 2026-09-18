# 频道托管协议

[客户端—中继协议](../README.md)

频道托管是客户端—中继协议的可选模块。客户端直接连接频道托管中继；频道操作不经过账户路由 DHT 或中继 RPC。中继提供频道托管服务时，必须完整实现本模块，并在有效 `RelayDescriptor` 中声明 `channel.host.v1` 能力。

创建者账户建立频道并自动成为 owner；owner 负责签署后续描述 revision，owner 与 moderator 可以维护公开时间线；具有有效设备会话的客户端可以解析和读取频道。托管中继验证操作权限，把频道描述、发帖、编辑和删除事件按接受顺序加入同一条频道时间线。频道关闭后描述和时间线永久停止写入。

## 协议内容

| 部分 | 内容 |
|---|---|
| [模型与时间线](concepts/model-and-timeline.md) | 固定托管、权限、描述 revision、统一时间线、帖子删除与有限保留 |
| [核心对象](core-objects.md) | 频道 ID、`ChannelDescriptor` 和 `ChannelEvent` |
| [频道管理方法](methods/channel-management.md) | 频道创建、查询、更新与关闭 |
| [时间线方法](methods/timeline.md) | 发布、编辑、删除、举报、读取和同步 |
| [订阅方法](methods/subscription.md) | 频道订阅集合替换、订阅上限与失败处理 |
| [频道通知](notifications/README.md) | 频道时间线变更通知 |

## 方法索引

以下方法均使用设备会话。

| 方法 | HTTP | WebSocket |
|---|---|---|
| [`channel.create`](methods/channel-management.md#channelcreate) | POST | JSON-RPC |
| [`channel.resolve`](methods/channel-management.md#channelresolve) | GET | JSON-RPC |
| [`channel.update`](methods/channel-management.md#channelupdate) | PUT | JSON-RPC |
| [`channel.close`](methods/channel-management.md#channelclose) | DELETE | JSON-RPC |
| [`channel.post`](methods/timeline.md#channelpost) | PUT | JSON-RPC |
| [`channel.post.edit`](methods/timeline.md#channelpostedit) | PATCH | JSON-RPC |
| [`channel.post.delete`](methods/timeline.md#channelpostdelete) | DELETE | JSON-RPC |
| [`channel.post.report`](methods/timeline.md#channelpostreport) | PUT | JSON-RPC |
| [`channel.read`](methods/timeline.md#channelread) | GET | JSON-RPC |
| [`channel.subscribe`](methods/subscription.md#channelsubscribe) | N/A | JSON-RPC |

HTTP/WSS 映射和错误遵循[客户端—中继方法约定](../methods/conventions.md)。

## 通知索引

- [`channel.timeline.changed`](notifications/README.md#channeltimelinechanged)

通知封装遵循[客户端—中继通知约定](../notifications/README.md)。

## 一致性要求

兼容实现须遵循[一致性测试边界](../../test-vectors/README.md#一致性测试边界)及[客户端方法公共约定](../methods/conventions.md)，并覆盖：

- 描述与生命周期：按[核心对象](core-objects.md)和[频道管理方法](methods/channel-management.md)验证 ID 派生、完整描述签名与替换、字段及总大小限制、连续 revision、冲突查询确认、当前描述防回退和关闭终态。
- 内容写入：按[时间线方法](methods/timeline.md)验证 owner/moderator 权限、完整请求与证书绑定、帖子幂等、编辑中省略与删除的区别、连续编辑重建、删除与举报冲突，以及正文和附件的签名保护与安全处理。
- 提交与保留：按[时间线生命周期](concepts/model-and-timeline.md#频道时间线生命周期)和[原子提交规则](concepts/model-and-timeline.md#原子提交与持久化规则)验证并发权限及状态检查、故障恢复、接受时间与序号稳定、保留配置变化、编辑和验证材料的保留依赖。
- 读取与重建：按 [`channel.read`](methods/timeline.md#channelread) 验证最新页、前向和后向读取、非连续位置、页内顺序、`has_more`、历史描述与证书验证，以及删除和清理后的可读范围。
- 订阅与通知：按[订阅方法](methods/subscription.md)和[频道通知](notifications/README.md)验证集合原子替换、清空、上限调低、失败明细与原集合保留，以及通知合并和补读；通知不得直接推进同步位置。
