# 中继 DHT 核心对象

[中继 DHT 协议](README.md)

## 资源键派生规则

DHT key 标识特定网络上下文中的一个逻辑资源。资源 key 输入是只用于派生 key、不在网络上传输的对象：

```json
{
  "$type": "meshline.dht.resource.account.route",
  "$context": "neo:860833102:0x...",
  "resource_id": "neo:860833102:..."
}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 资源类型；取值见[账户路由资源规则](#dht-资源标识) |
| `$context` | string | 是 | 可信[网络上下文](../general.md#网络上下文)的规范字符串，由本地构造 |
| `resource_id` | string | 是 | 资源标识；取值见[账户路由资源规则](#dht-资源标识) |

DHT key 定义为 `SHA-256(UTF8(Canonical JSON(资源 key 输入)))` 的原始 32 bytes。相同账户在不同网络上下文中产生不同 key。

本协议只接受能够按 [`AccountRoute`](#accountroute) 规则完整验证的账户路由资源。中继仍可按 Kademlia 路由规则为任意资源 key 执行 `FIND_NODE`，无需理解该 key 对应的资源。

## AccountRoute

`AccountRoute` 是由账户和当前归属中继共同签署、由该中继发布到 DHT 的路由声明；其他合格存储方可以按[重新发布与持久化](concepts/account-route-lifecycle.md#重新发布与持久化)规则原样复制有效文档。其他中继通过该声明定位 `profile.resolve`、`device.state.resolve`、设备状态查询和消息投递的目标中继。连接地址和中继验签公钥来自 Registry 和 `RelayDescriptor`，业务权限由相应对象的账户签名、设备签名和投递凭据决定。

客户端提交请求及跨中继转发遵循[调用与路由模型](../client-relay/concepts/roles-and-routing.md#调用与路由模型)。

```json
{
  "$type": "meshline.account.route",
  "account": "neo:860833102:NU...",
  "account_public_key": "base64url...",
  "revision": 1730000000123,
  "relay_id": "0x1234567890abcdef1234567890abcdef12345678",
  "updated_at": 1730000000,
  "expires_at": 1745552000,
  "account_signature": "base64url...",
  "relay_signature": "base64url..."
}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.account.route` |
| `account` | string | 是 | 路由所属账户的[账户 ID](../client-relay/core-objects/accounts-and-devices.md#账户-id)，必须符合相应链的账户规则，并与 `account_public_key` 派生的账户一致 |
| `account_public_key` | string | 是 | 能按[账户 ID](../client-relay/core-objects/accounts-and-devices.md#账户-id)规则派生出 `account` 的账户公钥，无 padding base64url；遵循[账户签名](../general.md#账户签名)中的公钥表示约定 |
| `revision` | integer | 是 | 路由记录的[非负单调版本](#路由版本生成规则)；范围和耗尽规则见[单调版本与计数器](../general.md#安全整数与计数器推进) |
| `relay_id` | string | 是 | 当前归属中继在 Registry 记录中的[中继 ID](../registry/core-objects.md#中继-id) |
| `updated_at` | integer | 是 | 路由签署时间 |
| `expires_at` | integer | 是 | 路由到期时间 |
| `account_signature` | string | 是 | `account` 按[账户签名规则](../general.md#账户签名)生成的签名，无 padding base64url |
| `relay_signature` | string | 条件 | `relay_id` 对应的 Neo N3 中继账户按[账户签名](../general.md#账户签名)生成的 64-byte 签名，无 padding base64url；发布请求中必须省略，最终文档中必须出现 |

`relay_id` 指定账户状态、资料、设备查询、路由发布和消息时间线的唯一当前归属中继。协议不定义备用中继或自动接管。

### 签名顺序

`AccountRoute` 按以下顺序签署，签名输入均按[网络绑定 JSON 输入](../general.md#网络绑定-json-输入)构造：

1. 账户签名输入排除根 `account_signature` 和 `relay_signature`；账户生成 `account_signature`。
2. 中继签名输入仅排除根 `relay_signature`，因此覆盖正文和收到的精确 `account_signature`；中继生成 `relay_signature`。

### 验证规则

对象必须先满足字段表定义的约束，并继续验证：

- 最终共同签名文档的完整 [Canonical JSON](../general.md#canonical-json) UTF-8 编码不得超过 4 KiB（4,096 bytes）；
- 发布中继以及验证 DHT 记录的存储方和查询方，必须独立确认 `updated_at` 不超过本地 Unix 秒加本地允许的未来偏差。超出时即使双方签名有效也必须拒绝，且不得用该请求或记录提高已保存的最高路由版本或改变冲突状态；
- `expires_at` 必须晚于 `updated_at`，与 `updated_at` 的差不得超过 10 年（按每年 365 天计，即 3,650 天或 315,360,000 秒），且记录在使用时尚未到期；
- 账户签名必须有效；最终文档还必须包含有效的中继签名，且签名公钥必须能派生出 `relay_id`。

验证方必须确认 `relay_id` 对应 Registry 记录的 `status` 为 `active`，并取得验证通过的当前 `RelayDescriptor`，再使用其中的 `public_key` 验证中继签名。

DHT 只接受最终共同签名文档。提交记录的 Peer 必须是已通过连接身份认证的合格公共中继。

### DHT 资源标识

`AccountRoute` 按[资源键派生规则](#资源键派生规则)生成 DHT key，资源类型规则如下：

| 项目 | 值 | 语义与约束 |
|---|---|---|
| `$type` | `meshline.dht.resource.account.route` | 标识账户路由资源类型 |
| `resource_id` | 账户路由文档所属账户 | [账户 ID](../client-relay/core-objects/accounts-and-devices.md#账户-id)；同一账户的所有路由版本使用同一资源 ID |
| 资源值编码 | `AccountRoute` 的 UTF-8 JSON bytes | 作为 Kademlia `Message.record.value` 传输；解码后按[AccountRoute 验证规则](#验证规则)验证 |

验证 DHT 记录时，接收方必须把 `Message.record.value` 解码为 UTF-8 JSON 并解析出 `AccountRoute`，以其中的规范 `account` 作为 `resource_id` 重新派生 key，并确认结果与 `Message.record.key` 完全相同。DHT 记录更新和候选值选择均遵循[路由版本与冲突解决](#路由版本与冲突解决)。

### 路由版本生成规则

`revision` 表示同一账户路由的版本顺序。同一账户的同一 `revision` 只能对应一份路由内容，账户和中继不得签署同版本但内容不同的路由。需要替换已知路由的新记录必须使用严格更大的值；必须产生[非负安全整数](../general.md#安全整数与计数器推进)，并在同一账户内保持单调递增。

`highest_known_revision` 是客户端已完整验证的最高最终路由版本与本账户在本地持久化的最后签署值中的较大者；两者都不存在时按 `-1` 处理。

推荐以当前 UTC Unix 毫秒为下限，并确保新值高于已知版本：

```text
revision = max(highest_known_revision + 1, current_unix_time_milliseconds)
```

客户端必须保证同一账户的多个设备不会为不同路由内容使用相同 `revision`。出现同版本不同内容时，按下述路由版本与冲突解决规则处理。

### 路由版本与冲突解决

#### 本地版本保留与防回退

中继必须按可信网络上下文和账户，独立持久化已经完整验证的最终路由的最高 `revision`、用于比较该版本路由内容的信息，以及尚未解决的同版本冲突状态。只有收到时尚未到期且通过全部验证的最终共同签名文档才能更新这些信息；未完成验证的发布草稿、无效记录和收到时已过期的记录不得提高最高版本。

最高版本只能增加，不得因路由或 DHT value 到期、缓存清理、账户迁移或节点重启而减小或清除。对应完整路由过期后不得作为有效路由返回、使用或重新发布；无论其本地内容是否保留，上述版本和冲突信息都必须永久保留。中继确认接受写入、返回解析结果或把新路由用于业务前，必须先持久化相应版本信息。

低于已保存最高版本的记录不得重新接受为当前路由，也不得通过缓存、DHT 查询或重新发布作为当前路由返回或使用。同版本相同内容的有效副本可以重新取得或重复发布。最高版本的路由已过期且没有可用的新路由时，该账户没有可用路由，必须等待账户签署更高版本，不能恢复使用仍未到期的旧版本。

这些信息只反映本中继已经验证过的路由。尚未见过新版本的节点仍须通过 DHT 查询发现更新，本地版本保留不构成全网已经撤销旧副本的证明。

#### 候选比较与冲突处理

路由内容比较使用排除 `account_signature` 和 `relay_signature` 后的网络绑定 JSON；两份文档的签名仍须分别通过验证。相同内容的重复副本不构成冲突。

对同一 DHT key 的所有候选值，按以下顺序处理：

1. 丢弃 key 不匹配或未通过[验证规则](#验证规则)的记录；这不清除已经保存的版本和冲突信息；
2. 排除低于本中继已保存最高版本的记录，再取剩余候选中 `revision` 最大的记录；同版本内容相同的副本视为同一候选路由，并与本地保存的同版本内容一起比较；
3. 最大 `revision` 对应不同内容时属于协议冲突，必须持久化冲突状态，不得按摘要或到达顺序从中选出有效路由，也不得回退到更低版本。

本次取得更高版本的有效候选时，按上述持久化要求推进本地最高版本；该最高版本存在不同内容时记录冲突，不返回其中任何一份作为有效路由。

存在尚未解决的同版本路由冲突时，中继必须暂停为该账户提供依赖当前路由的服务，直到取得高于冲突版本、内容无冲突的有效路由。冲突记录过期或后续查询只见其中一份，不构成更高版本替换。过滤后没有可用候选且不存在未解决冲突时，解析结果为没有可用路由。
