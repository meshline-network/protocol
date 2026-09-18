# Account and Device Lifecycle

[Client–relay protocol](../README.md) · [Device state methods](../methods/device-state.md) · [Account profile methods](../methods/profiles.md) · [Account profiles and device certificates](../core-objects/accounts-and-devices.md) · [AccountRoute](../../relay-dht/core-objects.md#accountroute)

## Account Initialization

Setting up an account requires these steps:

1. Sign a [`DeviceCertificate`](../core-objects/accounts-and-devices.md#devicecertificate) for each initially registered device.
2. The account signer constructs and signs an initial [`AccountDeviceState`](../core-objects/accounts-and-devices.md#accountdevicestate) containing those certificates.
3. Select and verify the intended home relay under [Candidate relay discovery](discovery-and-sessions.md#relay-discovery). Establish an [account session](../methods/authentication-and-sessions.md#authaccountverify), pre-store the device state, and confirm a `staged` response with a valid `staged_until`.
4. The client constructs an account-signed route draft naming that relay as `relay_id`. The relay adds its signature, atomically persists and activates the final route with the pre-stored device state used, then publishes the route to the DHT. The client verifies the successful response and saves the final document under [`account.route.publish`](../methods/account-routing.md#accountroutepublish).

The client may consider setup complete only after all steps succeed, their responses are verified under the respective methods, and current device state contains at least one currently valid device. If the publication result is unknown, confirm it using the method's query or retry rules; an unconfirmed result MUST NOT be treated as success.

The client may publish `AccountProfile` as needed through [`profile.publish`](../methods/profiles.md#profilepublish). Without a published profile, public discovery remains disabled; the account may still establish contacts through valid invitations or perform self-delivery.

## Device Changes and Recovery

For device changes, the client MUST first synchronize the complete current state, then have the account key sign a new complete state with a higher revision. If complete state cannot be obtained, follow the [account recovery rules](#route-switching-and-account-recovery).

Clients should cache complete state. Without a usable device session, or when holding only the account key, establish an account session first, then call `device.state.resolve` to read the account's own complete device state.

After a new device enters accepted state, it may send an `AccountContactSync` requesting a contact snapshot if it needs contact records; an existing device responds. Planned rotation MUST follow the ordering and revocation conditions in [Contact grant updates and synchronization](contacts.md#contact-grant-updates-and-synchronization).

Unexpected device loss may temporarily invalidate contact grants endorsed only by that device. Account device state can be recovered with the account key, but the protocol does not guarantee recovery of contact data stored only on devices.

## Home Relay Changes

### Migration Preparation and Steps

Before migration, the client should complete a round of message timeline synchronization on the old relay where possible, retaining fully processed records and their synchronization position. An unreachable old relay or failed synchronization does not prevent migration; account authorization, device state, route revision, and other requirements still apply.

When changing an account's home relay, the following MUST be done:

1. Re-sign the complete `AccountDeviceState` with the account key, using a `revision` strictly greater than the pre-migration state. Pre-store it on the new relay, confirm `staged`, and confirm that `staged_until` covers the expected migration window.
2. Generate an account-signed route draft with a higher `revision` and the new relay as `relay_id`, then submit it to the new relay for co-signing.
3. Verify the successful response under [`account.route.publish`](../methods/account-routing.md#accountroutepublish), confirming that the new route has been published and the device state used has been activated atomically with it. Subsequent device-state updates continue to follow increasing-revision rules.
4. A currently valid device establishes a device session on the new relay, republishes `AccountProfile`, and begins message timeline synchronization.
5. Submit new account-state writes and `message.send` to the new home relay.

### Message Delivery and Result Queries

#### Sender Account Migration

After the sender account migrates, the client submits `message.send` to the new home relay and no longer retries it on the old relay. The old relay rejects calls under the current-home requirement and no longer owes idempotent `message.send` responses.

Migration neither transfers nor cancels local or cross-relay delivery tasks already taken over by the old relay or their results. The old relay still completes existing tasks under its [reliable delivery responsibility](message-delivery.md#delivery-flow). As their source relay, it need not remain the sender account's current home relay during background delivery.

The status of accepted messages is still queried through [`message.delivery.status`](../methods/messaging.md#messagedeliverystatus) on the original accepting relay. That relay verifies the calling account through a valid device session and provides queries throughout result retention. It MUST NOT forward the query or return a stale-route error solely because the sender account migrated.

#### Recipient Account Migration

Recipient migration does not change the fact that the old relay has already accepted a message on the receiving side. During result retention, the old relay still confirms existing receiving results under the idempotency rules of [`message.deliver`](../../relay-rpc/methods/message-delivery.md#messagedeliver).

A local task accepted only on the sending side, but not yet on the receiving side, may become cross-relay delivery under the current route. Its sending-side acceptance time, deadline, and result retention period stay unchanged. If the result is unknown, the original target MUST be consulted first; retries and target changes follow [Delivery result confirmation and destination relay switching](message-delivery.md#delivery-result-confirmation-and-destination-relay-switching).

### Timeline Synchronization and Historical Catch-Up

Message timelines are not copied during account migration. Clients track the [synchronization position](../methods/messaging.md#messagetimelinesync) separately by account and relay: continue from the largest sequence among fully processed records on the currently connected relay, or use `-1` or omit `after` if there are none. Other devices coming online later follow the same rules to read messages still retained and visible to them.

After migration, the old relay MUST still provide [`message.timeline.sync`](../methods/messaging.md#messagetimelinesync) to clients with valid device sessions on that relay, returning records within their original device visibility and remaining retention periods, including records appended after the last pre-migration synchronization. It MUST NOT forward the request or return `route_stale` or `target_not_local` solely because the account migrated. Migration does not make invisible records readable; expired records follow the [history-gap rules](message-timeline.md#message-retention-and-history-gaps). Device-session establishment and invalidation still follow the [authentication and session rules](../methods/authentication-and-sessions.md#session-authentication).

Clients unable to finish synchronization before migration may catch up under these rules when the old relay becomes available again. Migration does not extend original retention periods or guarantee that unsynchronized records remain available when the old relay recovers.

Returning to a previously used relay continues the same account timeline on that relay. Even if all previous messages have been cleaned up, the relay MUST resume allocation after the permanently retained highest assigned sequence. Migrating away, returning, and ordinary route updates do not reset message sequence numbers or history-gap positions; route revision does not determine synchronization position. Previously read messages are deduplicated under the [Account message timeline](message-timeline.md#account-message-timeline) rules.

### Route Switching and Account Recovery

The protocol defines neither standby relays nor automatic takeover. The current home relay changes only when the account publishes a higher-`revision` route specifying a new `relay_id`.

A source relay using an old cached route may still contact the target account's former home relay. For destination-home determination and route errors, see [Relay RPC routing rules](../../relay-rpc/methods/conventions.md#target-relay-selection-and-route-refresh).

If neither the old relay nor any old device can provide complete state, a client holding the account key may designate a new relay and publish complete device state containing only new devices there. The client MUST ensure that the new state's `revision` is strictly greater than the pre-recovery revision. This state takes effect atomically with the new route on the publishing relay, becoming authoritative; every device in the old state loses authorization.

For route co-signing, DHT replication, resolution, caching, and republication, see [Account route publication and resolution](../../relay-dht/concepts/account-route-lifecycle.md) in the relay DHT protocol.
