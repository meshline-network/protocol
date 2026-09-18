# 方法、传输与错误约定

[客户端—中继协议](../README.md)

## 端点与认证

建立连接时，客户端必须根据 `relay_id` 按[中继发现](../concepts/discovery-and-sessions.md#中继发现)规则取得并验证当前 `RelayDescriptor`，再按[中继端点地址](../core-objects/relay-descriptor.md#中继端点地址)规定选择地址；以前取得的 URL 不具有持续权威性。客户端使用所选 HTTPS 基地址调用 HTTP API；存在 WSS 地址时，还可以使用 WebSocket API。使用频道或群组托管服务前，客户端必须确认有效 `RelayDescriptor` 声明了相应的 `channel.host.v1` 或 `group.host.v1` 能力。

通过 HTTP 调用需要会话的方法时，必须在 `X-Meshline-Session` 请求头中携带 `token`；通过 WebSocket 调用时，使用当前连接经认证绑定的会话。每个会话只对建立它的中继 origin、账户和会话模式有效；设备会话还绑定设备 ID。客户端不得把会话令牌发送给另一个 origin，即使两个地址属于同一中继。设备会话确认[调用账户与调用设备](../concepts/roles-and-routing.md#角色)，账户会话只确认调用账户，不能满足要求调用设备身份的方法。

客户端不得直接参与中继 DHT，也不得使用未经验证的中继地址。各类请求的目标中继及转发方式遵循[调用与路由模型](../concepts/roles-and-routing.md#调用与路由模型)。

## 方法与请求映射

### 方法路径

HTTP 请求地址由 `RelayDescriptor` 所列的 HTTPS 基地址与方法路径组成。方法路径由点分方法名中的 `.` 替换为 `/` 得到，各段保持大小写不变。

例如，基地址为 `https://relay.example.com/meshline/v1` 时，`relay.info` 对应 `GET https://relay.example.com/meshline/v1/relay/info`。

WSS 直接连接 `RelayDescriptor` 所列的完整 WSS 地址，不追加方法路径；方法名放在 JSON-RPC 请求中。WebSocket 和中继 RPC 的方法名仍使用点分形式。

### 请求参数与编码

#### JSON 正文与参数对象

HTTP 请求和响应携带 JSON body 时，`Content-Type` 的媒体类型必须为 `application/json`；`charset` 参数可以省略，出现时必须为 `utf-8`。接收方必须接受 `application/json` 和 `application/json; charset=utf-8`，按 HTTP 媒体类型语法解析，不按完整 header 值逐字比较；媒体类型、参数名和 `utf-8` 值不区分大小写，合法的参数引号与空白不改变含义。显式声明其他字符集时必须拒绝，不能据此改用其他编码或先转码后接受。正文始终遵循[协议总则](../../general.md#json-与字段表示)的 UTF-8 要求，包括省略 `charset` 的情况。

方法具有请求参数时，HTTP POST、PUT、PATCH 和 DELETE 的 body 直接承载完整参数对象，WebSocket JSON-RPC 请求的 `params` 承载同一对象。HTTP 不使用 JSON-RPC 封装；除 GET 外，请求参数不通过 query 传递。方法没有请求参数时，HTTP 请求不携带 body，WebSocket 请求可以省略 `params` 或使用空对象 `{}`，两者均按无参数调用处理。

当前调用形式的所有参数均可省略时，WebSocket 可以省略 `params` 或使用空对象，按该调用形式的默认值处理。`params` 出现时必须是 JSON object；显式 `null`、数组及其他非对象值均为 Invalid Params，不作为参数省略处理。

#### GET 查询参数

HTTP GET 请求参数按同名字段放入 query。中继必须接受合法的百分号编码形式，对参数名和值解码一次后，再按字段表的类型还原参数。

- 解码后的整数文本必须采用[安全整数](../../general.md#安全整数与计数器推进)规定的最短十进制形式，并满足相应字段的取值范围；布尔值使用小写 `true` 或 `false`。
- 省略可选字段时不生成相应 query 参数，同名标量参数不得重复。
- GET 不承载数组、对象或显式 `null`；携带签名或嵌套授权材料的查询使用 POST。
- GET 不改变会话与授权要求，也不意味着响应可以公开缓存。

解码后名称未由当前方法定义的 query 参数，中继必须忽略，不得仅因其存在拒绝请求。已定义参数仍须通过相应校验；未知参数不得替代必填字段或改变方法选择、会话与授权要求。

### 方法语义与接口一致性

| 方法 | 用途 |
|---|---|
| `GET` | 用于查询 |
| `PUT` | 建立或设置状态 |
| `PATCH` | 修改部分状态 |
| `DELETE` | 移除资源或可用状态 |
| `POST` | 用于创建、执行状态转换，或处理需要复杂签名与授权材料的查询 |

PUT 和 DELETE 的幂等性质约束重复请求产生的服务端效果，不要求不同时间的响应状态完全相同。客户端仍须按具体方法的重复请求和重试规则处理超时或响应丢失。

同一方法的 HTTP 和 WebSocket 接口，对相同调用形式和参数必须执行相同的参数校验、授权、状态变化、重复请求处理和错误语义，并使用相同的响应对象。

不提供 HTTP 接口的方法只通过 WebSocket 提供。

## 分页

本规范所有分页方法采用统一规则。`limit` 表示本页最多返回的条目数，出现时必须是[正安全整数](../../general.md#安全整数与计数器推进)。不符合类型或取值范围时返回 `bad_request`。省略时，中继根据本地资源策略和响应大小限制决定页大小。

显式提供 `limit` 时，中继可以按资源策略和响应大小限制降低本页返回数量，但不得超过请求值。合法 `limit` 大于中继本地页大小上限时，应缩小页面，不能仅因此按参数非法拒绝请求。

客户端必须根据相应方法的 `has_more` 或 `next` 判断是否继续分页，不能仅因本页数量少于 `limit` 或前一页数量就认为已经读完。页大小的调整不改变读取顺序、快照边界或同步位置的推进规则。

## HTTP 响应

方法定义响应对象时，成功返回 HTTP 200，body 直接承载相应 JSON 对象；没有响应对象时，成功返回 HTTP 204。

### `RelayError`

`RelayError` 是 HTTP 非成功响应使用的统一机器可读错误对象。

| 字段 | 类型 | 必需 | 语义 |
|---|---|---|---|
| `code` | string | 是 | [中继错误码](conventions.md#错误码) |
| `message` | string | 是 | 面向日志和诊断的文本，不用于程序分支 |
| `data` | object | 否 | 公共错误规则或具体方法定义的机器可读错误信息 |

### HTTP 状态映射

| HTTP 状态 | RelayError code |
|---:|---|
| `400` | 表中未另行映射的业务错误，包括 `bad_request`、`invalid_signature`、`device_unknown`、`clock_skew`、`stale_state`、`invalid_state`、`message_expired`、`target_not_local` 和 `route_stale` |
| `401` | `unauthorized` |
| `403` | `forbidden` |
| `404` | `not_found`、`route_not_found` |
| `409` | `state_conflict` |
| `413` | `request_too_large` |
| `429` | `rate_limited` |
| `503` | `internal_error`、`bad_gateway`、`temporarily_unavailable` |

客户端判断业务错误时，必须依据 JSON `code`，不得只依据 HTTP 状态。限流方可以确定等待时间时，按[限流重试等待规则](#限流重试等待规则)返回 `data.retry_after` 和一致的 `Retry-After`。

## WebSocket JSON-RPC

客户端向 `RelayDescriptor` 的 WSS endpoint 建立连接，并在 WebSocket text message 中交换 JSON-RPC 2.0 对象。每个 message 必须包含恰好一个完整 UTF-8 JSON object，最大 1 MiB；本协议不使用 JSON-RPC batch。binary message 必须以 close status `1003` 拒绝，超限以 `1009` 关闭。

JSON-RPC 扩展字段的处理遵循[协议总则](../../general.md#json-rpc-扩展字段)；扩展字段必须计入完整 message 的大小，且不得改变会话。

WebSocket 连接的认证、身份绑定和续期遵循[会话有效性与连接绑定](authentication-and-sessions.md#会话有效性与连接绑定)及[WebSocket 会话续期](authentication-and-sessions.md#websocket-会话续期)；通知的连接要求和断线补齐规则见[客户端—中继通知](../notifications/README.md)。

成功响应必须包含 `result` 且不得包含 `error`；失败响应必须包含 `error` 且不得包含 `result`。客户端不得假定响应顺序；应以 `id` 关联请求。

### 请求

```json
{"jsonrpc":"2.0","id":"client-1","method":"message.timeline.sync","params":{"after":41,"limit":50}}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `jsonrpc` | string | 是 | 固定为 `2.0` |
| `id` | string 或 integer | 是 | 客户端选择的不透明关联值；字符串的 UTF-8 编码不得超过 128 bytes，整数必须是[安全整数](../../general.md#安全整数与计数器推进)；在该连接的未完成请求中唯一 |
| `method` | string | 是 | 方法名称 |
| `params` | object | 条件 | 承载当前调用形式的请求参数；没有请求参数或所有参数均可省略时，可以省略或使用空对象 `{}` |

客户端不得发送无 `id` 的请求通知。顶层数组、非对象值以及 `jsonrpc`、`id` 或 `method` 不符合本表时构成 Invalid Request；`id` 不符合类型、大小或取值范围要求时，错误响应中的 `id` 为 `null`，不得回显该值。`params` 不符合相应方法定义时构成 Invalid Params。

### 成功响应

例如，`auth.challenge` 的成功响应为：

```json
{"jsonrpc":"2.0","id":"client-1","result":{"nonce":"base64url...","created_at":1730000000,"expires_at":1730000300}}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `jsonrpc` | string | 是 | 固定为 `2.0` |
| `id` | string 或 integer | 是 | 原样返回对应请求的 `id` |
| `result` | 任意 JSON 值 | 是 | 方法定义的响应对象；没有响应对象时为 `null` |

### 错误响应

```json
{"jsonrpc":"2.0","id":"client-1","error":{"code":-32001,"message":"authentication is required"}}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `jsonrpc` | string | 是 | 固定为 `2.0` |
| `id` | string、integer 或 null | 是 | 请求 `id` 可以确定且有效时原样返回；否则为 `null` |
| `error` | object | 是 | 本次调用的 JSON-RPC 错误 |

#### 错误对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `code` | integer | 是 | [中继错误码](conventions.md#错误码)的固定 JSON-RPC code，或者下表的 JSON-RPC 协议错误码 |
| `message` | string | 是 | 面向日志和诊断的文本，不用于程序分支 |
| `data` | object | 否 | 仅在公共错误规则或具体方法为该错误定义了机器可读的错误相关对象时出现；不用于重复携带字符串错误码或普通诊断文本 |

#### 协议错误码

| code | 名称 | 使用条件 |
|---:|---|---|
| `-32700` | Parse Error | text message 不是有效的单个 JSON 值；`id` 为 `null` |
| `-32600` | Invalid Request | JSON 值不是符合本节结构的单个请求对象；无法取得有效 `id` 时为 `null` |
| `-32601` | Method Not Found | 当前中继不支持该方法 |
| `-32602` | Invalid Params | `params` 或其中的请求参数不符合方法定义 |
| `-32603` | Internal Error | 中继无法归类的内部故障 |

## 错误码

HTTP 响应使用字符串 `code`。客户端 WebSocket 和[中继 RPC](../../relay-rpc/methods/conventions.md#json-rpc-20)使用 JSON-RPC 整数 `code`；下表给出两种编码对同一失败语义的固定映射。程序分支使用相应传输的 `code`，不得解析 `message`。

| 字符串 code | JSON-RPC code | 类别 | 含义与请求方行为 |
|---|---:|---|---|
| `bad_request` | `-32602` | 永久 | 方法参数或业务对象的结构、格式或取值无效 |
| `method_not_found` | `-32601` | 永久 | 当前中继不支持该方法 |
| `internal_error` | `-32603` | 临时 | 未分类服务端故障 |
| `unauthorized` | `-32001` | 永久 | 会话未建立、已过期或已撤销，HTTP 请求的会话令牌缺失或格式无效，或者 challenge 缺失、过期或已消费 |
| `forbidden` | `-32003` | 永久 | 有效会话的账户、设备或会话模式不满足当前方法的权限要求，或者有效业务身份没有相应权限 |
| `invalid_signature` | `-32004` | 永久 | 账户、设备、请求或业务对象的密码学签名无效；设备证书签名有效但当前不在有效状态时不得使用此码 |
| `device_unknown` | `-32005` | 条件 | 必需设备证书缺失或设备当前没有有效授权；认证和读取不区分从未存在、已移除、尚未生效、已到期或已撤销 |
| `clock_skew` | `-32006` | 条件 | 请求或消息的创建、更新时间未通过接收中继适用的时钟容错或请求新鲜度检查 |
| `not_found` | `-32010` | 条件 | 所请求路由、资料或对象不存在；是否重试取决于方法 |
| `state_conflict` | `-32011` | 永久 | 请求依据的版本、前置状态或并发条件已经变化，操作需要推进的版本或计数器已耗尽，或者标识复用不符合具体方法的重复请求规则；消息幂等重试中表示相同逻辑消息键对应不同请求内容 |
| `stale_state` | `-32012` | 条件 | 提交状态旧于已存状态 |
| `invalid_state` | `-32013` | 条件 | 所依赖账户存在尚未由更高版本替换的同版本路由冲突，或目标账户当前资料、设备与路由之间不一致，无法生成通过验证的响应 |
| `message_expired` | `-32014` | 永久 | 消息已经超出当前中继的消息递送期限、可确认的结果保留期已经结束且结果不可取得，或可靠投递责任未能在固化截止时间前确认完成 |
| `request_too_large` | `-32015` | 永久 | 请求已成功解析，但完整请求参数对象或方法限定的业务对象超过其大小上限；原始 frame 超限不产生业务响应 |
| `target_not_local` | `-32020` | 路由 | 本中继无法确认自己是目标账户的当前归属中继，且没有已知有效当前路由指向其他中继 |
| `route_stale` | `-32021` | 路由 | 本中继已知有效当前路由指向其他中继 |
| `route_not_found` | `-32022` | 路由 | 源中继未解析到路由 |
| `bad_gateway` | `-32023` | 临时 | 远端返回无法通过验证的响应；不得把该响应交给客户端 |
| `rate_limited` | `-32030` | 临时 | 请求受到速率或资源配额限制 |
| `temporarily_unavailable` | `-32031` | 临时 | Peer、网络或服务暂不可用 |

JSON-RPC 的 `-32700` 和 `-32600` 只描述客户端 WebSocket message 或中继 RPC frame 无法解析，或者其中的 JSON 不构成有效请求；它们不对应 HTTP 业务错误。

临时错误的自动重试采用本地退避策略，不得立即循环请求；消息投递还须遵循[投递期限与重试规则](../concepts/message-delivery.md#投递期限与重试)，`rate_limited` 还须遵循[限流重试等待规则](#限流重试等待规则)。

## 资源与安全控制

中继可以按连接、Peer、`relay_id`、账户、来源地址和操作类型实施资源配额或速率限制；具体阈值属于部署策略，不进入签名对象或协议版本判断。

客户端 API 和已完成请求解码的中继 RPC 请求超过速率或资源配额时，必须返回 `rate_limited`。已经完成消息分帧和解码、但方法请求参数超过该方法大小限制时，按[中继流与帧](../../relay-rpc/methods/conventions.md#流与帧)返回 `request_too_large`。请求在完成解码前已达到连接级上限时，中继可以直接拒绝或重置对应 stream。发起方必须把此类 stream 终止视为临时失败，并按[临时错误的重试约定](#错误码)处理。

### 限流重试等待规则

#### 提示生成与编码

`rate_limited` 可以通过错误对象的 `data.retry_after` 提供相对等待时间。HTTP 的 `RelayError.data`、客户端 WebSocket 和中继 RPC 的 `error.data` 使用同一结构：

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `retry_after` | integer | 否 | 从收到本次响应起，重试本次被限流请求前至少等待的秒数；必须是非负安全整数，不是 Unix 时间戳 |

限流方能够确定等待时间时必须提供该字段；无法确定时可以省略。该提示只适用于 `rate_limited`，不改变其他错误的处理语义。HTTP `429` 携带此字段时，必须同时返回数值相同的 `Retry-After`，使用 [RFC 9110 第 10.2.3 节](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)的 `delay-seconds` 形式；本协议的限流提示不使用 HTTP-date。不能提供等待提示时，省略该字段和对应 header。

例如，下列 HTTP 错误配合 `Retry-After: 30` 返回：

```json
{"code":"rate_limited","message":"request rate exceeded","data":{"retry_after":30}}
```

对应的 WebSocket 错误为：

```json
{"jsonrpc":"2.0","id":"client-1","error":{"code":-32030,"message":"request rate exceeded","data":{"retry_after":30}}}
```

#### 提示接收与转发

接收方自动重试时，必须同时满足此等待时间和本地退避策略，可以等待更久；省略提示时沿用本地退避策略。`0` 只表示没有额外等待要求，不允许绕过本地退避形成立即循环。提示不保证等待结束后请求一定成功，也不延长消息投递截止时间或其他业务有效期。

中继向客户端转发已经验证的 `rate_limited` 错误时，必须保留此字段，并按客户端所用传输方式的错误映射规则处理；接收方从收到相应响应时起算等待时间。非法提示值不得当作 `0` 或字段缺失处理，应按现有无效响应规则拒绝。Kademlia 消息和未形成错误响应的 stream 终止不携带此提示。
