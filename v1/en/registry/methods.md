# Relay Registry methods

[Relay Registry](README.md) · [RelayEntry](core-objects.md#relayentry)

## `getRelay`

`getRelay` reads the current membership record of the specified relay. The call does not require a witness.

### Parameters

| Parameter | ABI type | Constraints |
|---|---|---|
| `relayId` | `UInt160` | Identifies the relay to query |

### Return value

Returns the current [`RelayEntry`](core-objects.md#relayentry) if the relay is registered, or `null` otherwise.

A returned record does not mean the relay is currently available. Before using it as a candidate, the caller MUST also confirm that the record's `status` is `active` and complete the applicable descriptor and connection-identity verification.

## `listRelays`

`listRelays` enumerates all relay membership records. The call does not require a witness.

### Parameters

None.

### Return value

Returns `Iterator<RelayEntry>`, including records in every membership state. The caller uses only records whose `status` is `active` as candidates and MAY stop iteration once enough candidates have been obtained.

The enumeration order of `listRelays` has no protocol semantics.

## `getRelayRegistrationFee`

`getRelayRegistrationFee` reads the current fee applicable to first-time public-relay registration, for public-relay operators preparing to register. The call does not require a witness. The result reflects only the fee at the time of the query. The caller MUST use the current fee applicable when `registerRelay` executes and MUST NOT cache the query result as a fixed registration fee.

### Parameters

None.

### Return value

Returns an `Integer` representing the current registration fee in the smallest GAS unit; `0` means registration is free. GAS has 8 decimal places, so the integer `10000000000` represents `100 GAS`.

## `registerRelay`

`registerRelay` initially creates a public relay's [`RelayEntry`](core-objects.md#relayentry). It is for public-relay operators only, not for creating or using ordinary user accounts. The invoking transaction MUST include a `relayId` witness.

This method charges the current registration fee at contract execution time. No fee is charged if the current fee is `0`; if it is greater than `0`, the contract collects from `relayId` the GAS amount represented by that integer.

### Parameters

| Parameter | ABI type | Constraints |
|---|---|---|
| `relayId` | `UInt160` | Identifies the relay to register; the Registry MUST NOT already contain a record for this relay |
| `endpoint` | `String` | MUST satisfy every discovery-endpoint constraint of [`RelayEntry`](core-objects.md#relayentry) |

### Return value

When all parameter, witness, and fee conditions are met, the contract creates a `RelayEntry` with `status` set to `active` and returns the `Boolean` value `true`.

The call fails if a parameter type or value is invalid or payment of the registration fee fails. If authorization is insufficient or the relay is already registered, it returns `false`, leaves the record unchanged, and charges no registration fee.

## `updateRelayEndpoint`

`updateRelayEndpoint` allows an operator of an already registered public relay to update the record's discovery endpoint. The invoking transaction MUST include a `relayId` witness. The update does not change `status`.

### Parameters

| Parameter | ABI type | Constraints |
|---|---|---|
| `relayId` | `UInt160` | Identifies the relay whose discovery endpoint is to be updated; the Registry MUST already contain its record |
| `endpoint` | `String` | MUST satisfy every discovery-endpoint constraint of [`RelayEntry`](core-objects.md#relayentry) |

### Return value

After validation, `endpoint` is compared using its original string value. If it is unchanged, the entire record remains unchanged; otherwise, `endpoint` and `updated_at` are updated. Both cases return the `Boolean` value `true`.

If authorization is insufficient or the target record does not exist, the method returns `false` and leaves the record unchanged. The call fails if a parameter type or value is invalid.

## `setRelayEnabled`

`setRelayEnabled` allows an operator of an already registered public relay to enable or disable relay membership. The invoking transaction MUST include a `relayId` witness.

### Parameters

| Parameter | ABI type | Constraints |
|---|---|---|
| `relayId` | `UInt160` | Identifies the relay whose membership is to be enabled or disabled; the Registry MUST already contain its record |
| `enabled` | `Boolean` | `true` requests that the operator's relay membership be enabled; `false` requests that it be disabled |

### Return value

After validation, if the requested state equals the current state, the entire record remains unchanged. Otherwise, `status` is set to `active` or `disabled`, and `updated_at` is updated. Both cases return the `Boolean` value `true`.

If authorization is insufficient, the target record does not exist, or Registry governance has suspended membership, the method returns `false` and leaves the record unchanged. The call fails if a parameter type or value is invalid.
