# Relay Discovery and Sessions

[Client–relay protocol](../README.md) · [RelayDescriptor](../core-objects/relay-descriptor.md)

## Relay Discovery

A client or relay discovering public relays through the Registry MUST:

1. Obtain the [network context](../../general.md#network-context) from trusted configuration.
2. Use `listRelays()` to obtain candidate records or `getRelay` to query a known `relay_id`, following [Registry queries](../../registry/methods.md#getrelay). Consider only records whose `status` is `active`.
3. Confirm that `endpoint` meets the [Registry entry constraints](../../registry/core-objects.md#relayentry), then retrieve `RelayDescriptor` from `<endpoint>/relay/descriptor`.
4. Confirm that the descriptor's `relay_id` matches the selected Registry record, then validate it under the [RelayDescriptor validation rules](../core-objects/relay-descriptor.md#relay-descriptor-validation-rules).
5. Send requests only to successfully verified relays that actually provide the required service or function. When using an optional capability, also confirm that `RelayDescriptor.capabilities` includes its declaration.

Retrieving `RelayDescriptor` through this Registry flow MUST use the discovery entry point in the Registry record. After successful descriptor validation, business connections use candidate addresses in its `endpoints`. Without a cached, already verified `RelayDescriptor` that remains within its validity period, inability to connect to the discovery entry point means this Registry discovery attempt has failed.

When connecting to a candidate address from the DHT or accepting an inbound connection from an unknown relay, a relay obtains the peer's complete `RelayDescriptor` through the Noise handshake under [Relay connections and identity authentication](../../relay-dht/concepts/connection-and-authentication.md#candidate-discovery). The verifier queries the Registry by its `relay_id` and validates the descriptor and connection identity. A candidate address alone grants no business access.

## Session Modes

A session is identity and authorization state established after successful relay authentication. A session token (`token`) is a relay-issued credential the client uses to access that session.

This protocol defines two fixed session modes. The mode determines the identity proved by authentication and the methods the session may call; clients cannot freely combine purposes or scopes.

| Session mode | Authenticated identity | Permissions |
|---|---|---|
| `device` | A currently valid device of an account | May call methods requiring or permitting a device session, including publication of the account's own device state and reading device state |
| `account` | The account key holder | May call `device.state.publish`, `account.route.publish`, and read its own account's device state with `device.state.resolve`; cannot query other accounts with `device.state.resolve`, satisfy other methods' session requirements, establish subscriptions, or receive server notifications |

Account sessions support cases where no device has yet been established, all devices are unavailable, or account device-state recovery is needed. They do not correspond to a device and do not substitute for device sessions in profile, contact, message, channel, or group operations.

## Session Trust Boundaries

A device session proves only the account and device identity confirmed by the relay at establishment. An account session proves only the account key holder and cannot identify the calling device. Both are valid only for the [relay origin](../methods/authentication-and-sessions.md#relay-origin-calculation) that established them. After switching HTTPS origins or creating a new WSS connection, authentication in a mode allowed by the method MUST be performed again before calling a session-requiring method.

Session validity periods and the effects of device certificate renewal and device-state changes on existing sessions follow [`SessionCredentials`](../methods/authentication-and-sessions.md#sessioncredentials) and [Session validity and connection binding](../methods/authentication-and-sessions.md#session-validity-and-connection-binding).

While a WSS session remains valid, the client may reauthenticate on the same connection under [Session renewal](../methods/authentication-and-sessions.md#websocket-session-renewal), updating the session expiry while retaining subscriptions that remain valid.
