# Method, Transport, and Error Conventions

[Client–relay protocol](../README.md)

## Endpoints and Authentication

When connecting, clients MUST obtain and verify the current `RelayDescriptor` by `relay_id` under [Relay discovery](../concepts/discovery-and-sessions.md#relay-discovery), then select an address under [Relay endpoint addresses](../core-objects/relay-descriptor.md#relay-endpoint-addresses). Previously obtained URLs have no continuing authority. Clients use HTTPS addresses for the HTTP API based at `/meshline/v1`; a WSS address additionally enables the WebSocket API. Before using channel or group hosting, clients MUST confirm that a valid descriptor declares `channel.host.v1` or `group.host.v1`, respectively.

HTTP calls requiring a session MUST carry `token` in the `X-Meshline-Session` header. WebSocket calls use the authenticated session bound to that connection. Each session is valid only for the establishing relay origin, account, and session mode; device sessions also bind a device ID. Clients MUST NOT send tokens to another origin, even if both addresses belong to the same relay. Device sessions confirm the [calling account and device](../concepts/roles-and-routing.md#roles); account sessions confirm only the account and cannot satisfy methods requiring calling-device identity.

Clients MUST NOT participate directly in the relay DHT or use unverified relay addresses. Target relays and forwarding follow the [Calling and routing model](../concepts/roles-and-routing.md#calling-and-routing-model).

## Method and Request Mapping

### Method Paths

Construct HTTP request URLs by appending `/` and the dot-separated method name with each `.` replaced by `/` to the complete HTTPS base address in `RelayDescriptor`, preserving case in every segment. Without a deployment prefix, `relay.info` maps to `GET /meshline/v1/relay/info`, and `channel.post.edit` to `PATCH /meshline/v1/channel/post/edit`.

WSS connects directly to the complete listed WSS address without a method path; the method name goes in the JSON-RPC request. WebSocket and relay RPC retain dot-separated method names.

### Request Parameters and Encoding

#### JSON Bodies and Parameter Objects

HTTP requests and responses carrying JSON bodies MUST use media type `application/json` in `Content-Type`. `charset` may be omitted but, if present, MUST be `utf-8`. Recipients MUST accept both `application/json` and `application/json; charset=utf-8`, parsing HTTP media type syntax rather than comparing the complete header literally. Media type, parameter names, and `utf-8` are case-insensitive; valid parameter quoting and whitespace do not change meaning. An explicit different charset MUST be rejected, without switching encoding or transcoding before acceptance. Bodies always follow the [general protocol](../../general.md#json-and-field-representations) UTF-8 requirement, including when `charset` is omitted.

For methods with request parameters, HTTP POST, PUT, PATCH, and DELETE bodies directly carry the complete parameter object, and WebSocket JSON-RPC `params` carries the same object. HTTP does not use JSON-RPC envelopes. Except for GET, parameters are not passed in query strings. Parameterless HTTP requests have no body; WebSocket requests may omit `params` or use `{}`, both treated as parameterless.

If all parameters of the current invocation form are optional, WebSocket may omit `params` or use an empty object, applying that form's defaults. If present, `params` MUST be a JSON object. Explicit `null`, arrays, and other non-object values are Invalid Params, not omission.

#### GET Query Parameters

HTTP GET parameters use same-named query fields. Relays MUST accept valid percent-encoding, decode names and values once, then restore parameter types from the field table.

- Decoded integer text MUST use the shortest decimal form under [Safe integers](../../general.md#safe-integers-and-counter-advancement) and satisfy the field's range. Booleans use lowercase `true` or `false`.
- Omitted optional fields produce no query parameter. Scalar names MUST NOT repeat.
- GET carries no arrays, objects, or explicit `null`; queries with signatures or nested authorization material use POST.
- GET does not change session or authorization requirements or imply public cacheability.

Relays MUST ignore query parameters whose decoded names are not defined by the method, without rejecting solely for their presence. Defined parameters still must pass validation. Unknown parameters MUST NOT replace required fields or alter method selection, sessions, or authorization requirements.

### Method Semantics and Interface Consistency

| Method | Purpose |
|---|---|
| `GET` | Queries |
| `PUT` | Establish or set state |
| `PATCH` | Modify part of state |
| `DELETE` | Remove a resource or available state |
| `POST` | Create, perform state transitions, or process queries requiring complex signatures and authorization material |

PUT and DELETE idempotency constrains server effects of repeated requests; it does not require identical response status at different times. Clients still follow method-specific duplicate and retry rules after timeouts or lost responses.

HTTP and WebSocket interfaces for the same method MUST apply identical parameter checks, authorization, state changes, duplicate handling, error semantics, and response objects for identical invocation forms and parameters.

Methods without HTTP interfaces are available only through WebSocket.

## Pagination

All paginated methods use these common rules. `limit` is the maximum number of entries requested for this page and, if present, MUST be a [positive safe integer](../../general.md#safe-integers-and-counter-advancement). Invalid types or ranges return `bad_request`. When omitted, the relay chooses page size under local resource policy and response-size limits.

With explicit `limit`, the relay may reduce the returned count for resource or response-size limits but MUST NOT exceed the requested value. A valid `limit` above the local cap should yield a smaller page, not parameter rejection solely for that reason.

Clients MUST use the method's `has_more` or `next` to decide whether to continue, not infer completion from fewer entries than `limit` or the previous page. Page-size changes do not alter read order, snapshot boundaries, or cursor advancement rules.

## HTTP Responses

When a method defines a response object, success returns HTTP 200 with that JSON object directly in the body. Without a response object, success returns HTTP 204.

### `RelayError`

`RelayError` is the common machine-readable error object for unsuccessful HTTP responses.

| Field | Type | Required | Semantics |
|---|---|---|---|
| `code` | string | Yes | [Relay error code](conventions.md#error-codes) |
| `message` | string | Yes | Text for logs and diagnostics, not program branching |
| `data` | object | No | Machine-readable error details defined by common error rules or the method |

### HTTP Status Mapping

| HTTP status | RelayError code |
|---:|---|
| `400` | Business errors not otherwise mapped here, including `bad_request`, `invalid_signature`, `device_unknown`, `clock_skew`, `stale_state`, `invalid_state`, `message_expired`, `target_not_local`, and `route_stale` |
| `401` | `unauthorized` |
| `403` | `forbidden` |
| `404` | `not_found`, `route_not_found` |
| `409` | `state_conflict` |
| `413` | `request_too_large` |
| `429` | `rate_limited` |
| `503` | `internal_error`, `bad_gateway`, `temporarily_unavailable` |

Clients MUST identify business errors by JSON `code`, not HTTP status alone. When the limiter can determine a wait, it returns `data.retry_after` and a consistent `Retry-After` under [Rate-limit retry waiting rules](#rate-limit-retry-waiting-rules).

## WebSocket JSON-RPC

Clients connect to a WSS endpoint from `RelayDescriptor` and exchange JSON-RPC 2.0 objects in WebSocket text messages. Each message MUST contain exactly one complete UTF-8 JSON object, at most 1 MiB. This protocol does not use JSON-RPC batches. Binary messages MUST be rejected with close status `1003`; oversized messages close with `1009`.

JSON-RPC extension fields follow the [general rules](../../general.md#json-rpc-extension-fields); they MUST count toward complete message size and MUST NOT change sessions.

Connection authentication, identity binding, and renewal follow [Session validity and connection binding](authentication-and-sessions.md#session-validity-and-connection-binding) and [WebSocket session renewal](authentication-and-sessions.md#websocket-session-renewal). For notification connection requirements and catch-up after disconnection, see [Client–relay notifications](../notifications/README.md).

Successful responses MUST contain `result` and no `error`; failed responses MUST contain `error` and no `result`. Clients MUST NOT assume response order and should correlate requests by `id`.

### Requests

```json
{"jsonrpc":"2.0","id":"client-1","method":"message.timeline.sync","params":{"after":41,"limit":50}}
```

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `jsonrpc` | string | Yes | Fixed as `2.0` |
| `id` | string or integer | Yes | Opaque client-selected correlation value; string UTF-8 length MUST NOT exceed 128 bytes; integers MUST be [safe integers](../../general.md#safe-integers-and-counter-advancement); unique among outstanding requests on the connection |
| `method` | string | Yes | Method name |
| `params` | object | Conditional | Parameters of the current invocation form; may be omitted or `{}` when parameterless or all parameters are optional |

Clients MUST NOT send request notifications without `id`. Top-level arrays, non-object values, or `jsonrpc`, `id`, or `method` that fails this table constitute Invalid Request. If `id` fails type, size, or range requirements, the error response's `id` is `null`; the invalid value MUST NOT be echoed. `params` violating the method definition constitutes Invalid Params.

### Successful Responses

For example, a successful `auth.challenge` response is:

```json
{"jsonrpc":"2.0","id":"client-1","result":{"nonce":"base64url...","created_at":1730000000,"expires_at":1730000300}}
```

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `jsonrpc` | string | Yes | Fixed as `2.0` |
| `id` | string or integer | Yes | Echoes the corresponding request `id` unchanged |
| `result` | Any JSON value | Yes | Method-defined response object, or `null` when none |

### Error Responses

```json
{"jsonrpc":"2.0","id":"client-1","error":{"code":-32001,"message":"authentication is required"}}
```

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `jsonrpc` | string | Yes | Fixed as `2.0` |
| `id` | string, integer, or null | Yes | Echoes a determinable valid request `id`; otherwise `null` |
| `error` | object | Yes | JSON-RPC error for this call |

#### Error Object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `code` | integer | Yes | Fixed JSON-RPC code from [Relay error codes](conventions.md#error-codes), or a protocol error below |
| `message` | string | Yes | Log and diagnostic text, not program branching |
| `data` | object | No | Present only when common rules or the method define a machine-readable error-related object; not for duplicating string error codes or ordinary diagnostic text |

#### Protocol Error Codes

| code | Name | Condition |
|---:|---|---|
| `-32700` | Parse Error | Text message is not a valid single JSON value; `id` is `null` |
| `-32600` | Invalid Request | JSON value is not a single request object meeting this section; `id` is `null` if no valid ID can be obtained |
| `-32601` | Method Not Found | This relay does not support the method |
| `-32602` | Invalid Params | `params` or its parameters violate the method definition |
| `-32603` | Internal Error | Unclassified internal relay failure |

## Error Codes

HTTP responses use string `code`. Client WebSocket and [relay RPC](../../relay-rpc/methods/conventions.md#json-rpc-20) use integer JSON-RPC `code`; this table fixes both encodings for the same failure semantics. Program logic uses the code for its transport and MUST NOT parse `message`.

| String code | JSON-RPC code | Category | Meaning and caller behavior |
|---|---:|---|---|
| `bad_request` | `-32602` | Permanent | Invalid structure, format, or value in method parameters or business objects |
| `method_not_found` | `-32601` | Permanent | Method unsupported by this relay |
| `internal_error` | `-32603` | Temporary | Unclassified server failure |
| `unauthorized` | `-32001` | Permanent | Session absent, expired, or revoked; HTTP session token missing or malformed; or challenge missing, expired, or consumed |
| `forbidden` | `-32003` | Permanent | A valid session's account, device, or mode lacks method permissions, or a valid business identity lacks the required permission |
| `invalid_signature` | `-32004` | Permanent | Invalid cryptographic account, device, request, or business-object signature; MUST NOT be used for a validly signed device certificate whose device is not currently valid |
| `device_unknown` | `-32005` | Conditional | Required certificate missing or device lacks current valid authorization; authentication and reads do not distinguish nonexistent, removed, not-yet-effective, expired, or revoked devices |
| `clock_skew` | `-32006` | Conditional | Request/message creation or update time fails the receiving relay's applicable clock tolerance or freshness check |
| `not_found` | `-32010` | Conditional | Requested route, profile, or object does not exist; retry depends on the method |
| `state_conflict` | `-32011` | Permanent | Referenced revision, precondition, or concurrency condition changed; required revision/counter advancement is exhausted; or identifier reuse violates method-specific duplicate rules. For message idempotency, the same logical key has different request content |
| `stale_state` | `-32012` | Conditional | Submitted state is older than stored state |
| `invalid_state` | `-32013` | Conditional | A same-revision route conflict in a dependent account has not been superseded, or target profile, devices, and route are inconsistent and no verifiable response can be produced |
| `message_expired` | `-32014` | Permanent | Message exceeds this relay's delivery age limit, a known result-retention period ended with no available result, or reliable delivery could not be confirmed by its fixed deadline |
| `request_too_large` | `-32015` | Permanent | Request parsed successfully but the complete parameter object or method-limited business object exceeds its size cap; oversized raw frames produce no business response |
| `target_not_local` | `-32020` | Routing | This relay cannot confirm it is the target's current home relay and has no known valid current route pointing elsewhere |
| `route_stale` | `-32021` | Routing | This relay knows a valid current route pointing elsewhere |
| `route_not_found` | `-32022` | Routing | Source could not resolve a route |
| `bad_gateway` | `-32023` | Temporary | Remote response fails validation and MUST NOT be passed to the client |
| `rate_limited` | `-32030` | Temporary | Rate or resource quota restriction |
| `temporarily_unavailable` | `-32031` | Temporary | Peer, network, or service temporarily unavailable |

JSON-RPC `-32700` and `-32600` describe only unparseable client WebSocket messages or relay RPC frames, or JSON that is not a valid request. They do not correspond to HTTP business errors.

Automatic retries of temporary errors use local backoff and MUST NOT loop immediately. Message delivery additionally follows [Delivery deadlines and retries](../concepts/message-delivery.md#delivery-deadlines-and-retries), and `rate_limited` follows [Rate-limit retry waiting rules](#rate-limit-retry-waiting-rules).

## Resource and Security Controls

Relays may impose quotas or rate limits by connection, Peer, `relay_id`, account, source address, and operation type. Thresholds are deployment policy and do not enter signed objects or protocol-version decisions.

Client API requests and already decoded relay RPC requests exceeding rate or resource quotas MUST return `rate_limited`. Once framing and decoding are complete, parameters exceeding a method's size limit return `request_too_large` under [Relay streams and frames](../../relay-rpc/methods/conventions.md#streams-and-frames). If a connection-level limit is reached before decoding completes, the relay may directly reject or reset the stream. Initiators MUST treat such termination as a temporary failure under [Temporary-error retry conventions](#error-codes).

### Rate-Limit Retry Waiting Rules

#### Hint Generation and Encoding

`rate_limited` may provide a relative wait in error `data.retry_after`. HTTP `RelayError.data`, client WebSocket `error.data`, and relay RPC `error.data` use the same structure:

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `retry_after` | integer | No | Minimum seconds from receipt of this response before retrying the limited request; MUST be a nonnegative safe integer, not a Unix timestamp |

The limiter MUST provide it when it can determine a wait, and may omit it otherwise. This hint applies only to `rate_limited` and changes no other error semantics. HTTP `429` carrying it MUST also return a numerically identical `Retry-After` using `delay-seconds` under [RFC 9110 Section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3); this protocol does not use HTTP-date for rate-limit hints. If no wait can be supplied, omit both field and header.

For example, this HTTP error is returned with `Retry-After: 30`:

```json
{"code":"rate_limited","message":"request rate exceeded","data":{"retry_after":30}}
```

The corresponding WebSocket error is:

```json
{"jsonrpc":"2.0","id":"client-1","error":{"code":-32030,"message":"request rate exceeded","data":{"retry_after":30}}}
```

#### Hint Reception and Forwarding

Automatic retries MUST satisfy both this wait and local backoff; recipients may wait longer. Without a hint, use local backoff. `0` means only that there is no additional wait, not permission to bypass backoff and loop immediately. A hint guarantees neither success after waiting nor extension of delivery deadlines or other business validity periods.

When forwarding a verified `rate_limited` error to a client, a relay MUST preserve this field and apply the error mapping for that client's transport. Recipients measure waiting from receipt of the corresponding response. Invalid hint values MUST NOT be treated as `0` or omission; reject them under existing invalid-response rules. Kademlia messages and stream terminations without an error response carry no such hint.
