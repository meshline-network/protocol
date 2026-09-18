# 中继 RPC 方法公共约定

[中继 RPC 协议](../README.md)

中继 RPC 运行在[通过中继身份认证的 libp2p 连接](../../relay-dht/concepts/connection-and-authentication.md#中继连接与认证流程)上。

## 流与帧

中继间请求和通知使用 protocol ID `/meshline/relay/1.0.0`。每个 stream 只承载一个 JSON-RPC Request 或 Notification；Request 对应一个 response，Notification 不产生 response：

```text
unsigned-varint payload_length
payload_length bytes UTF-8 JSON
```

`unsigned-varint` 遵循统一的[消息长度前缀编码](../../general.md#消息长度前缀编码)规则。

- 接收方必须支持至少 1 MiB frame；
- 大于接收方限制的 frame、无效 varint、无效 payload 长度或非法 UTF-8 属于消息分帧失败；接收方必须立即关闭或 reset stream，不构造 JSON-RPC response；
- 成功读取的 frame 不是合法 JSON 时返回 Parse Error；合法 JSON 不构成有效请求对象时返回 Invalid Request；
- 已经解析出合法 JSON-RPC request 后，方法的 `params` 超过业务大小上限时返回 `request_too_large` 对应的 JSON-RPC 错误。

目标中继发送 response 后关闭 stream；Notification 的发送方发送唯一 frame 后关闭 stream，接收方处理完成后直接关闭，不发送应用层 frame。任一方不得在同一 stream 中附加第二个 request、第二个 response 或其他应用数据。

## JSON-RPC 2.0

方法封装按 [JSON-RPC 2.0](https://www.jsonrpc.org/specification) 执行，本协议明确收紧或替换的行为除外。

本协议不使用 batch。方法索引中的调用使用包含 `id` 的 Request；通知索引中的通知省略 `id`。

JSON-RPC 扩展字段的处理遵循[协议总则](../../general.md#json-rpc-扩展字段)；扩展字段必须计入完整 frame payload 的大小，且不得改变 Peer 身份。

成功响应必须包含 `result` 且省略 `error`；错误响应必须包含 `error` 且省略 `result`。

### 请求

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "device.status",
  "params": {
    "account": "neo:860833102:NA...",
    "device_id": "dev_..."
  }
}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `jsonrpc` | string | 是 | 固定为 `2.0` |
| `id` | string 或 integer | 是 | 源中继为本次 stream 内请求选择的不透明关联值；字符串的 UTF-8 编码不得超过 128 bytes，整数必须是[安全整数](../../general.md#安全整数与计数器推进) |
| `method` | string | 是 | 按大小写敏感的完整字符串与[方法索引](../README.md#方法索引)列出的方法名称匹配 |
| `params` | object | 条件 | 承载对应方法的请求参数；没有请求参数或所有参数均可省略时，可以省略或使用空对象 `{}` |

方法没有请求参数时，省略 `params` 与使用空对象 `{}` 均按无参数调用处理；所有参数均可省略时，两者均按该调用形式的默认值处理。`params` 出现时必须是 JSON object；显式 `null`、数组及其他非对象值均为 Invalid Params，不作为参数省略处理。

除上述类型、大小和取值范围约束外，本协议不限定 `id` 的格式。目标中继必须原样返回该值，不得从中解析业务信息。不同 stream 中的请求可以复用相同 `id`。源中继必须按承载请求的 stream 关联响应，并核对响应 `id` 与本流请求一致，不得仅凭 `id` 跨流匹配；[错误响应](#错误响应)允许 `id` 为 `null` 的情形仍按该节处理。`id` 不属于业务对象，不参与对象签名、业务重复判定或账户路由计算。

顶层数组、非对象值，以及不符合本表的 `jsonrpc`、`id` 或 `method` 构成 Invalid Request。`id` 不符合类型、大小或取值范围要求时，错误响应中的 `id` 为 `null`，不得回显该值。`params` 出现但不是 JSON object、缺少方法要求的必需参数，或者请求参数不符合方法定义时构成 Invalid Params。

### 成功响应

以下展示 [`device.status`](account-queries.md#devicestatus) 的完整响应结构：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "status": "active",
    "expires_at": 1730086400
  }
}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `jsonrpc` | string | 是 | 固定为 `2.0` |
| `id` | string 或 integer | 是 | 原样返回对应 request 的 `id` |
| `result` | 任意 JSON 值 | 是 | 方法定义的响应对象；响应对象为“无”时为 JSON `null` |

### 错误响应

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32030,
    "message": "request rate exceeded",
    "data": {"retry_after": 30}
  }
}
```

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `jsonrpc` | string | 是 | 固定为 `2.0` |
| `id` | string、integer 或 null | 是 | request 的 `id` 可以确定且符合请求约束时原样返回；Parse Error 或无法取得有效 `id` 的 Invalid Request 为 JSON `null` |
| `error` | object | 是 | 本次调用的 JSON-RPC 错误 |

#### 错误对象

| 字段 | 类型 | 必需 | 语义与约束 |
|---|---|---|---|
| `code` | integer | 是 | [公共错误约定](../../client-relay/methods/conventions.md#错误码)定义的固定 JSON-RPC code，或者下表的 JSON-RPC 协议错误码 |
| `message` | string | 是 | 面向日志和诊断的文本，不用于程序分支 |
| `data` | object | 否 | 仅在公共错误规则或具体方法为该错误定义了机器可读的错误相关对象时出现；不重复携带字符串错误码或普通诊断文本 |

#### 协议错误码

| code | 名称 | 使用条件 |
|---:|---|---|
| `-32700` | Parse Error | frame 是合法 UTF-8，但 payload 不是合法的单个 JSON 值；`id` 为 `null` |
| `-32600` | Invalid Request | JSON 值不是符合本节结构的单个请求对象；无法取得有效 `id` 时为 `null` |
| `-32601` | Method Not Found | 目标中继不支持该方法 |
| `-32602` | Invalid Params | `params` 或其中的请求参数不符合方法定义 |
| `-32603` | Internal Error | 目标中继无法归类的内部故障 |

## 目标中继选择与路由刷新

需要账户路由的方法在 `params` 中指定目标账户。源中继解析当前 `AccountRoute`，据此找到该账户的当前归属中继，但不在请求中传输该路由。目标中继从 方法的 `params` 取得目标账户，独立解析当前路由，并确认自己仍负责该账户。

已发现的同版本路由冲突尚未被更高版本替换时，依赖该账户当前路由的业务调用返回 `invalid_state`；该账户已经改由其他中继负责时返回 `route_stale`；无法确定当前归属中继时返回 `target_not_local`。

连接失败或收到临时错误时，源中继按需刷新 Registry、`RelayDescriptor` 或账户路由；需要刷新账户路由时，绕过缓存重新解析。只有账户发布版本更高且无冲突的新路由并指定其他归属中继时，源中继才切换目标。

## 资源与安全控制

资源配额、速率限制和限流等待提示遵循[公共资源与安全控制规则](../../client-relay/methods/conventions.md#资源与安全控制)。

中继可以断开或临时拒绝持续发送无效请求的 Peer。
