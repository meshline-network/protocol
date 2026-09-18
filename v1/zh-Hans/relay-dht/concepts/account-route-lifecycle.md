# 账户路由发布与解析

[中继 DHT 协议](../README.md) · [`AccountRoute`](../core-objects.md#accountroute) · [DHT 操作](../operations.md) · [归属中继变更](../../client-relay/concepts/account-and-device-lifecycle.md#归属中继变更)

## 发布与复制

账户路由文档所指定的当前归属中继负责完成新路由的共同签署和发布；其他合格存储方可以按[重新发布与持久化](#重新发布与持久化)规则复制已经生成的最终共同签名文档。新路由的完整发布流程为：

1. 客户端先确认指定中继保存着该账户的有效权威 `AccountDeviceState`，或者向它预存完整设备状态，并确认返回 `staged` 及有效的 `staged_until`；
2. 客户端构造 `revision` 高于已知版本、指定该中继且省略 `relay_signature` 的账户签名文档，再通过 [`account.route.publish`](../../client-relay/methods/account-routing.md#accountroutepublish) 提交；
3. 中继确认自身身份、Registry 状态和 `RelayDescriptor`，按照 [`AccountRoute` 验证规则](../core-objects.md#验证规则)验证除尚未生成的 `relay_signature` 外的全部约束，并确认本地仍保存该账户的有效权威状态或尚未到期的当前预存设备状态；
4. 验证通过后，中继只追加 `relay_signature`，形成最终共同签名文档；确认最终文档满足[对象验证规则](../core-objects.md#验证规则)中的大小限制后，按 [`account.route.publish`](../../client-relay/methods/account-routing.md#accountroutepublish) 的规则，将当前路由、相应的[路由版本信息](../core-objects.md#路由版本与冲突解决)及本次使用的设备状态在同一次本地原子提交中持久化并启用；
5. 中继按 Kademlia 查询规则查找接近资源 key 的合格 Peer，并向这些 Peer 执行 [`PUT_VALUE`](../operations.md#put_value)；
6. 存储方按 `PUT_VALUE` 规则处理记录并返回结果。

归属中继必须先完成路由与设备状态的本地原子提交，再向 DHT 复制记录。在达到中继自身的副本确认策略前，`account.route.publish` 不得返回成功。

## 重新发布与持久化

当前归属中继必须持久化自身负责重新发布的最终 `AccountRoute`，并在记录有效期间重新发布，使 DHT 中仍有可查询副本。节点重启后，必须继续重新发布仍有效且仍由自身负责的路由。

其他合格存储方可以通过 `PUT_VALUE` 重新发布本地保存的最终共同签名文档。重新发布前，必须按 [AccountRoute 验证规则](../core-objects.md#验证规则)重新确认记录有效，且该记录是本地已知最高 revision 的无冲突路由，本地 DHT value 也尚未失效。复制时必须原样保留完整文档，包括双方签名和全部未知属性。其他节点的复制不免除归属中继的持续维护义务。

过期记录不得作为查询结果返回，也不得用于路由或重新发布；相应的路由版本信息继续独立保留。重新发布同样遵循版本下界，不能恢复发布已经被更高版本替换的旧路由。

## 解析与候选选择

查询方按 Kademlia 查询规则从合格 Peer 解析目标 key，执行 [`GET_VALUE`](../operations.md#get_value)，验证查询过程中取得的候选 Peer，并收集能够按账户路由资源规则完整验证的记录。

查询完成后，查询方按[路由版本与冲突解决](../core-objects.md#路由版本与冲突解决)结合本地持久化的最高版本确定结果。客户端接口的响应及错误码见 [`account.route.resolve`](../../client-relay/methods/account-routing.md#accountrouteresolve) 方法定义。

解析结果可以缓存，但不得在 `AccountRoute` 到期或本地 DHT value 失效后继续使用。缓存不得绕过已经保存的最高版本或同版本冲突信息；缓存失效不清除这些信息。

解析后的目标中继选择、路由错误和重新解析遵循[中继 RPC 方法公共约定](../../relay-rpc/methods/conventions.md#目标中继选择与路由刷新)。
