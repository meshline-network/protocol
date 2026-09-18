# 频道时间线方法

[频道托管协议](../README.md) · [核心对象](../core-objects.md) · [方法公共约定](../../methods/conventions.md) · [时间线语义](../concepts/model-and-timeline.md#频道时间线生命周期)

## 频道内容写入规则

`channel.post`、`channel.post.edit` 和 `channel.post.delete` 的请求参数分别直接使用 `ChannelPost`、`ChannelPostEdit` 和 `ChannelPostDelete`。

### 身份与写入权限

托管中继通过设备会话确认调用账户和调用设备，使用该设备的证书验证业务对象签名，并确认对象类型与所调用的方法一致。

中继按接受操作时的当前描述确认调用账户是频道 owner 或任一 moderator，并将该描述版本记录到事件外层的 `descriptor_rev`。描述在客户端构造请求后发生变化本身不是拒绝理由；调用账户仍有权限且请求满足其他条件时，可以按新版本接受。

频道必须处于允许写入的开放状态；因频道已经关闭而拒绝发帖、编辑或删除请求时，按[关闭状态的错误规则](../concepts/model-and-timeline.md#频道时间线生命周期)返回 `state_conflict`。重复发布的识别与处理仍遵循 [`channel.post`](#channelpost) 的规则。

### 请求格式与内容校验

完整请求的 Canonical JSON UTF-8 编码不得超过 64 KiB（65,536 bytes）。签名时排除对象根部的 `device_signature`，保留全部其他已知和未知属性，再按[网络绑定 JSON 输入](../../../general.md#网络绑定-json-输入)规则构造签名输入。

帖子和编辑的正文复用 [`MessageBody`](../../core-objects/messages-and-content.md#messagebody)，图片、音频、视频等附件复用 [`ContentReference`](../../core-objects/messages-and-content.md#contentreference) 及[附件处理规则](../../core-objects/messages-and-content.md#附件处理规则)。

中继必须验证请求中正文和附件引用的字段结构；不符合时返回 `bad_request`。语法有效但尚不支持的正文媒体类型不得仅因此被拒绝。

正文中的附件引用遵循[哈希引用规则](../../core-objects/messages-and-content.md#正文中的附件引用)。中继必须检查请求中附件的 `hash` 格式有效且互不重复，否则返回 `bad_request`；不要求中继解析 Markdown 来检查引用目标。

### 事件持久化与保留

保留期限按事件的 `accepted_at` 和相应保留规则计算。

中继实际写入内容事件时，把完整请求对象逐字段保存为事件的 `payload`，包括其签名和未知属性。事件同时记录调用设备及权限验证所用的描述版本；操作生效时必须仍具有相应权限，记录版本、追加事件、固化接受时间、推进时间线头及更新帖子状态遵循[原子提交与持久化规则](../concepts/model-and-timeline.md#原子提交与持久化规则)要求。接受时已经确认的管理权限不因设备证书后来到期或被移除而追溯失效。帖子删除和记录清理规则见[频道时间线生命周期](../concepts/model-and-timeline.md#频道时间线生命周期)。

## `channel.post`

`channel.post` 在公共频道中创建一篇帖子。

| 项目 | 约定 |
|---|---|
| HTTP | `PUT /meshline/v1/channel/post` |
| 会话要求 | 设备会话 |
| WSS | `channel.post` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

请求参数直接采用发帖者签署的完整 `ChannelPost`；接受后，该对象原样成为事件的 `payload`。

#### `ChannelPost`

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.channel.post` |
| `channel_id` | string | 是 | 按[频道 ID](../core-objects.md#频道-id)规则派生的频道 ID |
| `message_id` | string | 是 | 发布账户为这篇帖子生成的[消息 ID](../../core-objects/messages-and-content.md#消息-id)；与频道和发布账户共同标识保留期内的发布请求 |
| `body` | [MessageBody](../../core-objects/messages-and-content.md#messagebody) | 否 | 纯文本或格式化正文；没有正文时省略 |
| `attachments` | array&lt;ContentReference&gt; | 否 | 帖子的媒体或文件附件；没有附件时为空数组或省略 |
| `device_signature` | string | 是 | 发帖者使用本次调用设备对完整 `ChannelPost` 排除本字段后生成的 64-byte Ed25519 签名，无 padding base64url |

帖子必须提供正文或至少一个附件；不满足时返回 `bad_request`。

发布账户必须为每篇新帖子生成不同的消息 ID。即使新帖的正文和附件与既有帖子完全相同，也必须使用新的消息 ID。

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `sequence` | integer | 是 | 原帖事件在频道时间线中的位置，必须是正安全整数 |

成功表示频道服务已经把帖子对象作为新事件的 `payload` 持久化。完全相同的重复发布返回原帖的 `sequence`，不产生新事件。

### 处理与错误

托管中继按[频道内容写入规则](#频道内容写入规则)验证请求。

在原帖的频道历史保留期限内，同一频道、同一发布账户和同一消息 ID 只能对应一份 `ChannelPost`。重复发布以完整 `ChannelPost` 的 [Canonical JSON](../../../general.md#canonical-json) 是否相同判定。相同时，中继返回原帖的 `sequence`，不追加事件、不推进 sequence，也不发送通知；不同时，返回 `state_conflict`。即使原帖已经删除，其消息 ID 仍须至少占用至[接受时确定的最低保留截止时间](../concepts/model-and-timeline.md#频道时间线生命周期)，后续配置调整不得提前结束该占用期。

发布帖子的响应丢失时，客户端可以原样重试包含相同 `message_id` 和签名的完整 `ChannelPost`；中继必须返回原帖的 `sequence` 且不得重复追加。客户端不得仅因尚未在时间线中看到该帖子，就换用新的 `message_id` 自动重发，否则会形成一篇新的帖子。

## `channel.post.edit`

`channel.post.edit` 为既有帖子追加公开编辑事件。

| 项目 | 约定 |
|---|---|
| HTTP | `PATCH /meshline/v1/channel/post/edit` |
| 会话要求 | 设备会话 |
| WSS | `channel.post.edit` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

请求参数直接采用编辑者签署的完整 `ChannelPostEdit`；实际改变帖子状态时，该对象原样成为事件的 `payload`。

#### `ChannelPostEdit`

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.channel.post.edit` |
| `channel_id` | string | 是 | 要编辑帖子所属的频道 ID |
| `target_sequence` | integer | 是 | 目标帖子在同一频道时间线中的 `sequence`；必须是正安全整数，并指向尚未删除的既有 `ChannelPost` |
| `body` | MessageBody 或 null | 否 | 省略时保持当前正文；显式 `null` 删除正文；提供对象时以完整[正文](../../core-objects/messages-and-content.md#messagebody)替换当前正文 |
| `attachments` | array&lt;ContentReference&gt; 或 null | 否 | 省略时保持当前附件集合；显式 `null` 删除附件字段；提供数组时完整替换当前集合 |
| `device_signature` | string | 是 | 编辑者使用本次调用设备对完整 `ChannelPostEdit` 排除本字段后生成的 64-byte Ed25519 签名，无 padding base64url |

正文、附件和编辑对象根部的未知属性独立按相同规则增量修改：省略保持当前值，显式 `null` 删除字段，其他值新增或完整替换该字段。对象和数组均完整替换，不递归合并内部字段。编辑对象必须至少提供正文、附件或一个可映射的未知属性；更新后的帖子必须保留正文或至少一个附件，否则返回 `bad_request`。

用于更新和比较的帖子状态包含正文、附件及帖子根部的未知属性，初始值取自原始 `ChannelPost`，此后按时间线顺序应用编辑。

编辑请求的 `$type`、`channel_id`、`target_sequence` 和 `device_signature` 不合并到帖子状态。未知属性不得与 `ChannelPost` 的已定义字段重名；其余映射限制遵循[字段映射规则](../../../general.md#字段映射)。违反映射限制时返回 `bad_request`。编辑对象的全部未知属性仍参与签名，并在产生事件时原样保留。

删除仍被正文引用的附件时，发送方应当同时移除或修改相应引用。客户端在应用本次编辑后的有效附件集合中解析哈希引用：省略附件数组时可以引用保留下来的附件；显式替换或清空后，不得为缺失目标从更早的集合补齐。

### 响应对象

无。

帖子状态发生变化时，编辑对象作为新事件的 `payload` 加入频道公开时间线；状态未变化时也返回成功，但不产生事件。

### 处理与错误

托管中继按[频道内容写入规则](#频道内容写入规则)验证请求。

`target_sequence` 必须指向同一频道内已经存在的 `ChannelPost`；`target_sequence` 格式或取值范围非法，或指定位置存在但不是 `ChannelPost` 时返回 `bad_request`；指定位置不存在或相关状态已经清理时返回 `not_found`；中继仍保存目标已经删除的状态时返回 `state_conflict`。拒绝不得追加事件，编辑权限不取决于目标帖作者。

本次编辑是否改变帖子状态，以操作生效时编辑前后状态的 [Canonical JSON](../../../general.md#canonical-json) 是否相同为准。两者的 UTF-8 字节相同时，本次调用成功但不追加事件、不推进 sequence，也不发送通知；不同时，中继追加完整编辑对象并更新帖子状态，原帖及此前编辑事件不被改写。

编辑事件追加和状态更新必须原子生效，并发编辑以中继实际接受并提交的时间线顺序为准。客户端先验证原始事件签名，再按时间线顺序计算包含未知属性的当前帖子状态。

## `channel.post.delete`

`channel.post.delete` 为既有帖子追加公开删除事件。

| 项目 | 约定 |
|---|---|
| HTTP | `DELETE /meshline/v1/channel/post/delete` |
| 会话要求 | 设备会话 |
| WSS | `channel.post.delete` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

请求参数直接采用删除操作发起者签署的完整 `ChannelPostDelete`；删除成功后，该对象原样成为事件的 `payload`。

#### `ChannelPostDelete`

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `$type` | string | 是 | 固定为 `meshline.channel.post.delete` |
| `channel_id` | string | 是 | 要删除帖子所属的频道 ID |
| `target_sequence` | integer | 是 | 目标帖子在同一频道时间线中的 `sequence`；必须是正安全整数，并指向尚未删除的既有 `ChannelPost` |
| `reason` | string | 否 | 面向频道读者公开的删除说明；出现时必须至少包含一个非[空白字符](../../../general.md#文本空白字符) |
| `device_signature` | string | 是 | 删除操作发起者使用本次调用设备对完整 `ChannelPostDelete` 排除本字段后生成的 64-byte Ed25519 签名，无 padding base64url |

`reason` 不参与权限或状态判断；出现时属于设备签名覆盖的业务对象内容。

### 响应对象

无。

成功表示删除对象已经作为新事件的 `payload` 加入频道公开时间线；目标帖子及其既有编辑已停止返回。

### 处理与错误

托管中继按[频道内容写入规则](#频道内容写入规则)验证请求。

`reason` 出现但为空或仅包含空白，或者 `target_sequence` 格式或取值范围非法、指向现存的非 `ChannelPost` 事件时返回 `bad_request`；指定位置不存在或相关状态已经清理时返回 `not_found`；中继仍保存目标已经删除的状态时返回 `state_conflict`。删除权限不取决于目标帖作者。

成功时，把完整删除事件加入频道公开时间线，以及使目标帖子及此前指向它的全部编辑停止通过 `channel.read` 返回，必须原子生效；任一部分失败都不得改变频道状态或时间线。原帖子和编辑占用的 sequence 保留为空缺，不得重新分配。此后再次删除同一帖子时，按上述目标状态规则返回错误，不得产生新的删除事件。

## `channel.post.report`

`channel.post.report` 允许调用账户通过本次所用设备向频道托管中继举报一篇帖子。举报不是频道事件，不进入公开时间线。举报本身不构成隐藏、删除或限制目标帖的授权。

| 项目 | 约定 |
|---|---|
| HTTP | `PUT /meshline/v1/channel/post/report` |
| 会话要求 | 设备会话 |
| WSS | `channel.post.report` |
| HTTP 成功状态 | `204 No Content` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `channel_id` | string | 是 | 按[频道 ID](../core-objects.md#频道-id)规则派生的频道 ID；必须由当前连接中继托管 |
| `target_sequence` | integer | 是 | 被举报帖子在同一频道时间线中的 `sequence`；必须是正安全整数，并指向尚未删除的 `ChannelPost` |
| `reason` | string | 是 | 举报原因；必须至少包含一个非[空白字符](../../../general.md#文本空白字符) |

### 响应对象

无。

成功表示举报已经被中继持久化，不表示中继已经采取处置措施。

### 处理与错误

同一账户对同一频道帖子只保留一份当前举报记录。再次举报同一帖子时，中继以本次请求的原因、调用设备和本地接受时间完整替换原记录。

`reason` 为空、仅包含空白或超过中继配置的长度上限，或者 `target_sequence` 格式或取值范围非法、指向现存的非 `ChannelPost` 事件时返回 `bad_request`；指定位置不存在或相关状态已经清理时返回 `not_found`；中继仍保存目标已经删除的状态时返回 `state_conflict`。拒绝不得建立或替换举报记录。

## `channel.read`

`channel.read` 读取一个频道的最新一页、向更旧的现存历史翻页，或者从客户端已经完成处理的位置向前同步后来加入且仍可读取的事件。

| 项目 | 约定 |
|---|---|
| HTTP | `GET /meshline/v1/channel/read` |
| 会话要求 | 设备会话 |
| WSS | `channel.read` |
| HTTP 成功状态 | `200 OK` |

### 请求参数

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `channel_id` | string | 是 | 要读取的频道 ID，按[频道 ID](../core-objects.md#频道-id)规则派生 |
| `before` | integer | 否 | 只返回 sequence 严格小于该值的现存记录；必须是非负安全整数 |
| `after` | integer | 否 | 只返回 sequence 严格大于该值的现存记录；从频道创建处开始同步时可以使用 `-1`，其他值必须是非负安全整数 |
| `limit` | integer | 否 | 本页最多返回的条目数；必须为正安全整数，遵循[分页约定](../../methods/conventions.md#分页) |

`before` 与 `after` 的组合按下表处理：

| 边界参数组合 | 行为 |
|---|---|
| 两者都省略 | 读取查询开始时的最新一页 |
| 仅提供 `before` | 向更旧的历史翻页 |
| 仅提供 `after` | 向更新的事件同步 |
| 两者同时提供 | 返回 `bad_request` |

### 响应对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `events` | array&lt;[ChannelEvent](../core-objects.md#channelevent)&gt; | 是 | 当前页仍可读取的事件，按 sequence 严格升序排列；已经删除的帖子及其既有编辑、以及原帖已不可用的编辑事件不得出现；没有符合条件的事件时为空数组 |
| `certificates` | array&lt;DeviceCertificate&gt; | 是 | 本页事件的 `signer_device_id` 引用的设备证书；按派生设备 ID 去重 |
| `has_more` | boolean | 是 | 是否沿当前读取方向还有可返回的事件；最新页和 `before` 模式下表示本页第一项之前还有更旧事件，`after` 模式下表示本页最后一项之后还有更新事件 |

`has_more` 为 `true` 的响应必须包含至少一项。

客户端按[频道事件的设备证书](../core-objects.md#频道事件的设备证书)验证证书和引用关系，使用被引用证书验证已知业务对象签名，并从证书确定操作账户。

### 处理与错误

#### 读取模式与边界

两项边界参数都省略时，中继必须在查询开始时确定本页快照边界，并选择不晚于该边界的最新可读事件。继续向旧历史翻页可以使用本页第一项的 sequence 作为 `before`；读取本页之后的新事件可以使用最后一项的 sequence 作为 `after`。新追加的事件具有更大的 sequence，不会改变已有的历史分页边界。

携带 `before` 时，只返回该位置之前的可读记录。`before` 不必指向仍可读取的记录；数值大于当前时间线头时与省略两项边界参数得到相同的最新页，值为 0 时返回空数组且 `has_more` 为 `false`。

携带 `after` 时，中继从值大于该位置的最早可读事件开始向前返回；继续读取后续页可以使用本页最后一项的 sequence。`after` 大于当前时间线头时返回 `bad_request`。请求位置本身无需对应已经分配或仍可读取的记录；中继直接跳过未分配、已删除或已清理的位置。sequence 不连续不表示同步失败，也不单独证明某项本地记录已经删除。

边界参数只约束本次请求返回的事件范围，不表示客户端已经读取、验证或处理该位置及以前的事件。

#### 客户端验证与应用

客户端选择采用某条事件时，必须按[频道事件](../core-objects.md#channelevent)和[频道事件的设备证书](../core-objects.md#频道事件的设备证书)规则验证。描述对象的验证和本地当前描述的更新遵循 [`ChannelDescriptor`](../core-objects.md#channeldescriptor) 的规则。所需描述可以来自缓存、本页描述事件，或按确切 revision 调用 [`channel.resolve`](channel-management.md#channelresolve) 取得；客户端按需补取缺少的版本。缺少目标描述或验证失败时，不得采用依赖它的内容事件。

内容事件必须使用同一频道、且 `revision` 等于该事件 `descriptor_rev` 的已验证描述，按[频道时间线生命周期](../concepts/model-and-timeline.md#频道时间线生命周期)规则确认操作权限。删除事件可以引用已经不再返回的帖子。客户端选择应用有效的 `ChannelPostDelete` 时，必须从本地频道时间线中移除目标帖子及此前指向它的全部编辑；本地不存在目标帖时按已经删除处理。
