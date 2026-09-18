# Common Relay RPC method conventions

[Relay RPC protocol](../README.md)

Relay RPC runs over [libp2p connections authenticated with relay identities](../../relay-dht/concepts/connection-and-authentication.md#relay-connection-and-authentication-flow).

## Streams and frames

Inter-relay requests and notifications use protocol ID `/meshline/relay/1.0.0`. Each stream carries exactly one JSON-RPC Request or Notification. A Request has one response; a Notification produces no response:

```text
unsigned-varint payload_length
payload_length bytes UTF-8 JSON
```

`unsigned-varint` follows the common [message length-prefix encoding](../../general.md#message-length-prefix-encoding) rules.

- Receivers MUST support frames of at least 1 MiB;
- A frame exceeding the receiver's limit, an invalid varint, an invalid payload length, or invalid UTF-8 is a message-framing failure. The receiver MUST immediately close or reset the stream without constructing a JSON-RPC response;
- A successfully read frame that is not valid JSON returns Parse Error. Valid JSON that does not form a valid request object returns Invalid Request;
- After a valid JSON-RPC request has been parsed, if its method's `params` exceed the business size limit, return the JSON-RPC error corresponding to `request_too_large`.

The target relay closes the stream after sending its response. A Notification sender closes the stream after sending the single frame; the receiver closes it directly after processing, without sending an application-layer frame. Neither party may append a second request, a second response, or other application data to the same stream.

## JSON-RPC 2.0

Method envelopes follow [JSON-RPC 2.0](https://www.jsonrpc.org/specification), except where this protocol explicitly tightens or replaces its behavior.

This protocol does not use batches. Calls in the method index use Requests containing `id`; notifications in the notification index omit `id`.

JSON-RPC extension fields follow the [general conventions](../../general.md#json-rpc-extension-fields). Extensions MUST count toward the size of the complete frame payload and MUST NOT change peer identity.

A successful response MUST contain `result` and omit `error`; an error response MUST contain `error` and omit `result`.

### Requests

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

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `jsonrpc` | string | Yes | Fixed to `2.0` |
| `id` | string or integer | Yes | An opaque correlation value selected by the source relay for this stream's request; a string's UTF-8 encoding MUST NOT exceed 128 bytes, and an integer MUST be a [safe integer](../../general.md#safe-integers-and-counter-advancement) |
| `method` | string | Yes | Matched as a complete, case-sensitive string against method names in the [method index](../README.md#method-index) |
| `params` | object | Conditional | Carries the method's request parameters; when there are no parameters or all parameters are optional, it MAY be omitted or be the empty object `{}` |

For a method without request parameters, omitting `params` and supplying `{}` are both treated as a parameterless call. When all parameters are optional, both use the defaults for that call form. If present, `params` MUST be a JSON object; explicit `null`, arrays, and other non-object values are Invalid Params and are not treated as omission.

Other than the type, size, and range constraints above, this protocol imposes no format on `id`. The target relay MUST return it unchanged and MUST NOT extract business information from it. Requests on different streams MAY reuse the same `id`. The source relay MUST correlate a response using the stream that carried the request and verify that the response `id` equals this stream's request `id`; it MUST NOT match across streams solely by `id`. Cases permitting `null` under [error responses](#error-responses) remain governed by that section. `id` is not part of a business object and does not participate in object signatures, business-duplicate detection, or account-route computation.

A top-level array, a non-object value, or a `jsonrpc`, `id`, or `method` that violates this table constitutes Invalid Request. If `id` violates its type, size, or range constraints, the error response's `id` is `null` and MUST NOT echo the invalid value. Present `params` that are not a JSON object, missing required method parameters, or parameters that violate the method definition constitute Invalid Params.

### Successful responses

The following shows the complete response structure for [`device.status`](account-queries.md#devicestatus):

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

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `jsonrpc` | string | Yes | Fixed to `2.0` |
| `id` | string or integer | Yes | Returns the corresponding request's `id` unchanged |
| `result` | any JSON value | Yes | The response object defined by the method; JSON `null` when the response object is specified as None |

### Error responses

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

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `jsonrpc` | string | Yes | Fixed to `2.0` |
| `id` | string, integer, or null | Yes | Returns the request's `id` unchanged when it can be determined and satisfies request constraints; JSON `null` for Parse Error or Invalid Request without an obtainable valid `id` |
| `error` | object | Yes | The JSON-RPC error for this call |

#### Error object

| Field | Type | Required | Semantics and constraints |
|---|---|---|---|
| `code` | integer | Yes | The fixed JSON-RPC code defined by the [common error conventions](../../client-relay/methods/conventions.md#error-codes), or a JSON-RPC protocol error code from the table below |
| `message` | string | Yes | Text for logging and diagnostics, not for program branching |
| `data` | object | No | Present only when the common error rules or the specific method defines a machine-readable error-related object for this error; does not repeat a string error code or ordinary diagnostic text |

#### Protocol error codes

| code | Name | Condition |
|---:|---|---|
| `-32700` | Parse Error | The frame is valid UTF-8, but its payload is not a valid single JSON value; `id` is `null` |
| `-32600` | Invalid Request | The JSON value is not a single request object conforming to this section; `id` is `null` when a valid `id` cannot be obtained |
| `-32601` | Method Not Found | The target relay does not support this method |
| `-32602` | Invalid Params | `params` or its request parameters violate the method definition |
| `-32603` | Internal Error | An internal target-relay failure that cannot be classified |

## Target relay selection and route refresh

Methods requiring account routing specify the target account in `params`. The source relay resolves the current `AccountRoute` and uses it to find the account's current home relay, but does not transmit that route in the request. The target relay obtains the target account from the method's `params`, independently resolves the current route, and confirms that it remains responsible for the account.

If a discovered same-version route conflict has not been superseded by a higher version, business calls depending on that account's current route return `invalid_state`. If another relay is now responsible for the account, they return `route_stale`. If the current home relay cannot be determined, they return `target_not_local`.

On connection failure or a temporary error, the source relay refreshes the Registry, `RelayDescriptor`, or account route as needed. When refreshing an account route, it bypasses the cache and resolves it again. It switches targets only when the account has published a higher-version, conflict-free route designating another home relay.

## Resource and security controls

Resource quotas, rate limits, and throttling wait hints follow the [common resource and security control rules](../../client-relay/methods/conventions.md#resource-and-security-controls).

A relay MAY disconnect or temporarily reject peers that continue to send invalid requests.
