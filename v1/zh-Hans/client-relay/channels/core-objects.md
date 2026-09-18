# 频道核心对象

[频道托管协议](README.md)

## 频道 ID

`channel_id` 标识由用户创建、由一个公共中继托管的公共频道。创建频道的客户端必须生成新的 16-byte `nonce`，以无 padding 的 base64url 编码；`nonce` 必须匹配 `^[A-Za-z0-9_-]{22}$`。同一创建者在同一中继下的 `nonce` 不得重复，推荐使用密码学安全随机源生成。

频道 ID 的派生输入如下：

```json
{
  "$type": "meshline.channel.identity",
  "$context": "neo:860833102:0x...",
  "nonce": "base64url...",
  "creator": "neo:860833102:...",
  "relay_id": "0x..."
}
```

| 字段 | 类型 | 必需 | 来源与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.channel.identity` |
| `$context` | string | 是 | 可信[网络上下文](../../general.md#网络上下文)的规范字符串，由本地构造 |
| `nonce` | string | 是 | 创建者设备生成的 16-byte 值 |
| `creator` | string | 是 | 创建频道的调用账户 |
| `relay_id` | string | 是 | 托管该频道的中继 ID |

频道 ID 按下式派生，其中 `channel_identity_input` 表示上述频道标识输入：

```text
channel_id_input = UTF8(Canonical JSON(channel_identity_input))
channel_id_digest = SHA-256(channel_id_input)
channel_id = "chan_" + base64url(first_16_bytes(channel_id_digest))
```

`channel_id` 必须匹配 `^chan_[A-Za-z0-9_-]{22}$`。验证方必须从 `ChannelDescriptor` 取得 `nonce`、`creator` 和 `relay_id`，再结合可信网络上下文重新计算频道 ID。频道名称、简介、moderator 账户集合和状态版本不参与派生。

## `ChannelDescriptor`

`ChannelDescriptor` 是频道身份、公开资料和管理状态的签名声明。

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.channel.descriptor` |
| `channel_id` | string | 是 | 按[频道 ID](#频道-id)规则派生的频道 ID；验证时结合描述字段和可信网络上下文重新计算 |
| `nonce` | string | 是 | [频道 ID](#频道-id)派生使用的 16-byte 值；创建后保持不变 |
| `creator` | string | 是 | 频道创建者的[账户 ID](../core-objects/accounts-and-devices.md#账户-id)；创建时必须等于设备会话账户；创建后保持不变 |
| `relay_id` | string | 是 | 托管中继 ID；创建后保持不变并参与 `channel_id` 派生 |
| `name` | string | 是 | 频道名称；必须至少包含一个非[空白字符](../../general.md#文本空白字符)，最多 256 UTF-8 bytes |
| `description` | string | 否 | 公开简介；非空时不得仅包含[空白字符](../../general.md#文本空白字符)，且最多 4 KiB（4,096 UTF-8 bytes） |
| `moderators` | array&lt;string&gt; | 否 | 频道 moderator 的[账户 ID](../core-objects/accounts-and-devices.md#账户-id)数组，最多 10 个；moderator 的权限见[频道业务模型](concepts/model-and-timeline.md)；账户 ID 按其定义使用大小写敏感的完整字符串比较；为空时可以省略；不得重复或包含频道 owner 账户 |
| `revision` | integer | 是 | 频道描述的非负连续版本；创建时为 0，每次成功更新恰好加 1；范围和耗尽规则见[单调版本与计数器](../../general.md#安全整数与计数器推进) |
| `status` | string | 是 | 频道的当前状态：创建时为 `active`，关闭后为 `closed`；生命周期规则见[频道时间线生命周期](concepts/model-and-timeline.md#频道时间线生命周期) |
| `created_at` | integer | 是 | 创建者设备签署初始描述的 Unix 秒；更新时保持不变 |
| `updated_at` | integer | 是 | 签署当前描述 revision 时的客户端 Unix 秒 |
| `device_signature` | string | 是 | 本次调用设备对当前 `ChannelDescriptor` 生成的 64-byte Ed25519 签名，无 padding base64url |

完整 `ChannelDescriptor` 的 Canonical JSON UTF-8 编码不得超过 8 KiB（8,192 bytes），计入 `device_signature` 和全部未知属性。各字段自身的约束与完整对象的总大小限制必须同时满足。

### 签名与验证

签署设备生成 `device_signature` 时排除根 `device_signature`，并按[网络绑定 JSON 输入](../../general.md#网络绑定-json-输入)规则构造签名输入。

不同 revision 可以由创建者账户的不同设备签署。描述进入时间线时，事件外层字段及设备证书引用遵循[频道事件](#channelevent)和[频道事件的设备证书](#频道事件的设备证书)规则。

验证方必须按 [`DeviceCertificate`](../core-objects/accounts-and-devices.md#devicecertificate) 的定义验证对应签署设备证书的签名及身份绑定，确认其 `account` 逐字等于描述中的 `creator`，使用其中的设备签名公钥验证 `device_signature`，重新计算 `channel_id`，并确认描述中的 `relay_id` 是当前连接的托管中继。验证方还必须取得该中继的有效 `RelayDescriptor`，并在使用频道托管服务时确认其 `capabilities` 包含 `channel.host.v1`。

托管中继在接受创建、更新或关闭时必须确认签署设备当前获授权；已经接受并仍须保留的 `ChannelDescriptor` 不因该设备证书后来到期或被移除而失效。

### 缓存与历史描述

客户端通过 `channel.resolve` 或 `channel.read` 取得描述后，可以保存描述及对应的签署设备证书。从二维码或第三方取得的描述只是待验证材料，客户端必须连接其中指定的中继并调用 `channel.resolve` 查询当前描述。

更新本地已验证并保存的当前频道描述时，新描述必须通过适用验证，且其 revision 必须严格大于本地当前 revision；相同或较小 revision 不得覆盖当前状态。按指定 revision 取得的历史描述仍可用于验证对应历史事件，但不得替换已有的同 revision 描述或回退当前状态。

频道描述的保留、可查询性及历史事件验证，遵循[频道时间线生命周期](concepts/model-and-timeline.md#频道时间线生命周期)规则。

## `ChannelEvent`

频道时间线按托管中继接受事件的顺序排列频道创建、描述更新和公开内容操作。`ChannelEvent` 是 `channel.read` 返回的事件：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `sequence` | integer | 是 | 托管中继在当前频道内分配的非负、严格单调递增序号；频道创建事件固定为 0，后续事件的值必须大于当前时间线头；必须是[安全整数](../../general.md#安全整数与计数器推进) |
| `descriptor_rev` | integer | 是 | 该事件对应的频道描述版本，必须是非负安全整数；描述事件使用其完整描述的版本，内容事件使用中继接受操作时生效的描述版本 |
| `payload` | object | 是 | 该事件的完整业务对象；已知类型为 [`ChannelDescriptor`](#channeldescriptor)、[`ChannelPost`](methods/timeline.md#channelpost-1)、[`ChannelPostEdit`](methods/timeline.md#channelpostedit-1) 或 [`ChannelPostDelete`](methods/timeline.md#channelpostdelete-1)，也可以是以后定义的未知 `$type` |
| `accepted_at` | integer | 是 | 托管中继接受该记录的本地 Unix 秒 |
| `signer_device_id` | string | 是 | 签署该事件业务对象的设备 ID，引用本页 `certificates` 中的证书 |

`sequence` 和 `accepted_at` 由中继生成；`descriptor_rev` 由中继按上述规则记录，`signer_device_id` 来自接受写请求时的设备会话。这些外层字段不属于业务对象的签名输入。事件追加、序号分配和清理遵循[频道时间线生命周期](concepts/model-and-timeline.md#频道时间线生命周期)规则，写入须满足[原子提交与持久化规则](concepts/model-and-timeline.md#原子提交与持久化规则)要求。

客户端必须确认每个已知业务对象中的 `channel_id` 都是所查询的频道。客户端采用同一响应中的事件更新频道状态时，必须按 sequence 严格升序应用已通过验证的事件。

sequence 0 必须是 revision 为 0 的初始 `ChannelDescriptor`；所有描述事件的外层 `descriptor_rev` 必须与内嵌描述的版本一致。每个后续 `ChannelDescriptor` 对应一个唯一的正整数 revision。历史清理可以使可读取的描述和时间线出现 revision 缺口，但不得复用或重新编号已分配的 revision。

所有已知业务对象均使用外层 `signer_device_id` 引用的证书验证签名。未知事件不强制使用已知业务对象的字段结构，不能改变已知频道状态；客户端可以将其作为已忽略事件消费对应 sequence。

### 频道事件的设备证书

所有频道事件都通过外层 `signer_device_id` 标识签署业务对象的设备。托管中继使用本次调用设备的证书验证业务对象签名，接受后把从该证书派生的设备 ID 写入事件，并在事件仍可读取时保留提供历史验证所需的设备证书。该证书所属账户标识频道创建者、发帖者、编辑者或删除操作的发起者。

`channel.read` 在响应级 `certificates` 数组中提供本页 `signer_device_id` 引用的证书，并按证书派生的设备 ID 去重。

中继持有同一设备的多个证书版本时，可以在 `channel.read` 或 `channel.resolve` 响应中返回其中一份签名有效的证书。客户端使用设备签名公钥验证历史业务对象，不以证书当前有效期或当前授权状态追溯否定中继已经接受的操作。

客户端必须按 [`DeviceCertificate`](../core-objects/accounts-and-devices.md#devicecertificate) 的定义验证响应级证书数组中的每份证书，并派生设备 ID；派生结果不得重复，所得 ID 集合必须覆盖本页事件的操作设备引用集合。证书数组的顺序没有协议语义。
