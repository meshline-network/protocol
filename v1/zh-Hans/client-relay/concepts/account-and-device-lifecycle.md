# 账户与设备生命周期

[客户端—中继协议](../README.md) · [设备状态方法](../methods/device-state.md) · [账户资料方法](../methods/profiles.md) · [账户资料与设备证书](../core-objects/accounts-and-devices.md) · [AccountRoute](../../relay-dht/core-objects.md#accountroute)

## 账户初始化

账户设立需要完成以下步骤：

1. 为初始登记的每台设备签署 [`DeviceCertificate`](../core-objects/accounts-and-devices.md#devicecertificate)；
2. 账户签名方构造并签署包含这些证书的初始 [`AccountDeviceState`](../core-objects/accounts-and-devices.md#accountdevicestate)；
3. 按[候选中继发现](discovery-and-sessions.md#中继发现)规则选择并验证拟使用的归属中继，建立[账户会话](../methods/authentication-and-sessions.md#authaccountverify)后预存该设备状态，并确认返回 `staged` 及有效的 `staged_until`；
4. 客户端构造以该中继作为 `relay_id` 的账户签名路由草稿，中继补充签名，将最终路由与所用预存设备状态原子持久化并启用，再发布到 DHT；客户端按 [`account.route.publish`](../methods/account-routing.md#accountroutepublish) 的规则验证成功响应并保存最终文档。

以上步骤全部成功、相应响应已按各方法验证，且当前设备状态至少包含一台当前有效设备时，客户端即可把该账户视为设立完成。发布结果不明时，按相应方法的查询或重试规则确认，不得将未确认的结果视为成功。

客户端可以按需通过 [`profile.publish`](../methods/profiles.md#profilepublish) 发布 `AccountProfile`。未发布资料时，公开发现保持关闭；账户仍可通过有效邀请建立联系人关系或进行自身投递。

## 设备变更与恢复

设备变更时，客户端必须先同步当前完整状态，再由账户密钥签署版本更高的新完整状态。无法取得完整状态时，按[账户恢复规则](#路由切换与账户恢复)处理。

客户端应缓存完整状态；没有可用设备会话或只持有账户密钥时，先建立账户会话，再调用 `device.state.resolve` 读取自身完整设备状态。

新设备进入已接受状态后，如需同步联系人记录，可以发送请求联系人快照的 `AccountContactSync`，由已有设备响应。计划内轮换须遵循[联系人授权更新与同步](contacts.md#联系人授权更新与同步)规定的顺序和撤销条件。

设备意外丢失可能使只有该设备背书的联系人授权暂时失效；账户设备状态可以由账户密钥恢复，但协议不保证恢复只存在于设备端的联系人数据。

## 归属中继变更

### 迁移准备与步骤

迁移前，客户端应尽可能在原中继完成一轮消息时间线同步，并保留已完成处理的记录及其同步位置。原中继不可达或同步失败不阻止迁移；账户授权、设备状态和路由版本等要求仍须满足。

账户更换归属中继时必须：

1. 由账户密钥重新签署完整 `AccountDeviceState`，使用严格高于迁移前状态的 `revision`。向新中继预存该状态，确认响应为 `staged`，并确认 `staged_until` 覆盖预计的迁移窗口；
2. 生成 `revision` 更高、以新中继作为 `relay_id` 的账户签名路由草稿，并提交给新中继完成共同签署；
3. 按 [`account.route.publish`](../methods/account-routing.md#accountroutepublish) 的规则验证成功响应，确认新路由已发布且所用设备状态已随路由原子启用；后续设备状态更新继续遵循版本递增规则；
4. 由当前有效设备在新中继建立设备会话，再重新发布 `AccountProfile` 并开始同步消息时间线；
5. 将新的账户状态写入和 `message.send` 提交给新归属中继。

### 消息投递与结果查询

#### 发送账户迁移

发送账户迁移后，客户端向新归属中继提交 `message.send`，不再向原中继重试该方法。原中继按当前归属要求拒绝调用，不再承担 `message.send` 的幂等响应义务。

迁移不转移或取消原中继已经接管的本地或跨中继投递任务及其结果。原中继仍按[可靠投递责任](message-delivery.md#投递流程)完成既有任务；它作为这些任务的源中继，不要求在后台投递时仍是发送账户的当前归属中继。

已接受消息的状态仍通过 [`message.delivery.status`](../methods/messaging.md#messagedeliverystatus) 向原接受中继查询。原中继按有效设备会话验证调用账户，在结果保留期内提供查询，不得仅因发送账户已迁移而转发查询或返回路由失效错误。

#### 收件账户迁移

收件账户迁移不改变原中继收件侧已经接受消息的事实。原中继在结果保留期内，仍按 [`message.deliver`](../../relay-rpc/methods/message-delivery.md#messagedeliver) 的幂等规则确认既有收件结果。

仅发送侧接受、收件侧尚未接受的本地任务，可以按当前路由转为跨中继投递；发送侧接受时间、截止时间和结果保留期保持不变。结果不明时，必须先向原目标确认，重试和目标切换遵循[投递结果确认与目标中继切换](message-delivery.md#投递结果确认与目标中继切换)。

### 时间线同步与历史补读

消息时间线不随账户迁移复制。客户端按账户和中继分别确定[同步位置](../methods/messaging.md#messagetimelinesync)：使用当前连接中继上已完成处理的记录中最大的 sequence 继续；没有这样的记录时使用 `-1`，也可以省略 `after`。其他设备稍后上线时遵循相同规则，读取仍保留且对其可见的消息。

迁移后，原中继仍须向持有本中继有效设备会话的客户端提供 [`message.timeline.sync`](../methods/messaging.md#messagetimelinesync)，返回原有设备可见范围和记录剩余保留期内的记录，包括迁移前最后一次同步后追加的记录。不得仅因账户已迁移而转发该请求或返回 `route_stale`、`target_not_local`。不可见记录不因迁移变得可读，过期记录按[历史缺口规则](message-timeline.md#消息保留与历史缺口)处理；设备会话的建立和失效仍遵循[认证与会话规则](../methods/authentication-and-sessions.md#会话认证)。

迁移前未能完成同步的客户端，可以在原中继恢复可用后按上述规则补读。迁移不延长原记录的保留期，也不保证尚未同步的记录在原中继恢复时仍可取得。

重新加入曾使用过的中继时，继续使用该账户在该中继上的同一条时间线；即使此前消息已经全部清理，中继仍须从永久保留的最高已分配序号之后继续分配。账户迁出、重新加入和普通路由更新都不重置消息序号或历史缺口位置；路由版本不决定同步位置。已经读取过的消息按[账户消息时间线](message-timeline.md#账户消息时间线)的规则去重。

### 路由切换与账户恢复

协议不定义备用中继或自动接管；只有账户发布指定新 `relay_id` 的更高 `revision` 路由，当前归属中继才改变。

源中继使用旧路由缓存时，可能仍访问目标账户的原归属中继；目标归属判断及路由错误处理见[中继 RPC 路由规则](../../relay-rpc/methods/conventions.md#目标中继选择与路由刷新)。

旧中继和全部旧设备均无法提供完整状态时，持有账户密钥的客户端可以指定新中继，并在那里发布只包含新设备的完整设备状态。客户端必须保证新状态的 `revision` 严格高于恢复前的版本。该状态与新路由在发布中继本地原子生效，成为权威状态；旧状态中的全部设备均不再获授权。

账户路由的共同签署、DHT 复制、解析、缓存和重新发布见中继 DHT 协议的[账户路由发布与解析](../../relay-dht/concepts/account-route-lifecycle.md)。
