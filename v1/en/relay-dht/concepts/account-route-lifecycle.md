# Account route publication and resolution

[Relay DHT protocol](../README.md) · [`AccountRoute`](../core-objects.md#accountroute) · [DHT operations](../operations.md) · [Changing the home relay](../../client-relay/concepts/account-and-device-lifecycle.md#home-relay-changes)

## Publication and replication

The current home relay designated by an account route document is responsible for jointly signing and publishing the new route. Other eligible storage nodes MAY replicate the resulting final jointly signed document under [republication and persistence](#republication-and-persistence). The complete new-route publication flow is:

1. The client first confirms that the designated relay holds the account's valid authoritative `AccountDeviceState`, or stages the complete device state there and confirms a `staged` response with a valid `staged_until`;
2. The client constructs an account-signed document with a `revision` higher than the known version, designating that relay and omitting `relay_signature`, then submits it through [`account.route.publish`](../../client-relay/methods/account-routing.md#accountroutepublish);
3. The relay confirms its own identity, Registry status, and `RelayDescriptor`, validates all [`AccountRoute` constraints](../core-objects.md#validation-rules) except the not-yet-generated `relay_signature`, and confirms that it still locally holds the account's valid authoritative state or its unexpired current staged device state;
4. After validation, the relay appends only `relay_signature`, forming the final jointly signed document. After confirming that it satisfies the size limit in the [object validation rules](../core-objects.md#validation-rules), it persists and activates the current route, corresponding [route-version information](../core-objects.md#route-version-and-conflict-resolution), and device state used in this operation in the same local atomic commit, under [`account.route.publish`](../../client-relay/methods/account-routing.md#accountroutepublish);
5. The relay uses Kademlia lookup rules to find eligible peers close to the resource key and performs [`PUT_VALUE`](../operations.md#put_value) against them;
6. Storage nodes process the record and return results under the `PUT_VALUE` rules.

The home relay MUST complete the local atomic commit of the route and device state before replicating the record into the DHT. `account.route.publish` MUST NOT return success before the relay's own replica-acknowledgement policy has been met.

## Republication and persistence

The current home relay MUST persist the final `AccountRoute` objects it is responsible for republishing and republish them during their validity period so that queryable copies remain in the DHT. After restart, it MUST continue republishing routes that remain valid and remain its responsibility.

Other eligible storage nodes MAY republish locally held final jointly signed documents through `PUT_VALUE`. Before republishing, they MUST revalidate the record under the [AccountRoute validation rules](../core-objects.md#validation-rules), confirm it is the conflict-free route at the highest locally known revision, and confirm that its local DHT value has not expired. Replication MUST preserve the complete document unchanged, including both signatures and all unknown properties. Replication by other nodes does not relieve the home relay of its continuing maintenance obligation.

Expired records MUST NOT be returned as query results or used for routing or republication; their route-version information remains retained independently. Republication also respects the version lower bound and cannot resume publication of an old route superseded by a higher version.

## Resolution and candidate selection

The querying node resolves the target key through eligible peers using Kademlia lookup rules, performs [`GET_VALUE`](../operations.md#get_value), validates candidate peers obtained during the lookup, and collects records that can be fully validated under the account route resource rules.

After the lookup completes, the querying node determines the result under [route version and conflict resolution](../core-objects.md#route-version-and-conflict-resolution), taking its locally persisted highest version into account. Client-interface responses and error codes are defined by [`account.route.resolve`](../../client-relay/methods/account-routing.md#accountrouteresolve).

Resolution results MAY be cached but MUST NOT remain in use after the `AccountRoute` expires or the local DHT value expires. A cache MUST NOT bypass retained highest-version or same-version-conflict information; cache expiry does not clear that information.

Target selection after resolution, routing errors, and re-resolution follow the [common Relay RPC method conventions](../../relay-rpc/methods/conventions.md#target-relay-selection-and-route-refresh).
