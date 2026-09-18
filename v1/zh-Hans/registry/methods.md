# 中继注册表方法

[中继注册表](README.md) · [RelayEntry](core-objects.md#relayentry)

## `getRelay`

`getRelay` 读取指定中继的当前成员记录。调用不要求 witness。

### 调用参数

| 参数 | ABI 类型 | 约束 |
|---|---|---|
| `relayId` | `UInt160` | 标识要查询的中继 |

### 返回值

已注册时返回当前 [`RelayEntry`](core-objects.md#relayentry)，未注册时返回 `null`。

返回记录不表示中继当前可用；作为候选中继使用时，还必须确认记录的 `status` 为 `active`，并完成相应的描述符与连接身份验证。

## `listRelays`

`listRelays` 枚举全部中继成员记录。调用不要求 witness。

### 调用参数

无。

### 返回值

返回 `Iterator<RelayEntry>`，包含所有成员资格状态的记录。调用方仅将 `status` 为 `active` 的记录作为候选，可以在取得足够候选后停止遍历。

`listRelays` 的枚举顺序不具有协议语义。

## `getRelayRegistrationFee`

`getRelayRegistrationFee` 读取公共中继首次注册时适用的当前注册费，供准备注册的公共中继运营者调用。调用不要求 witness。查询结果只反映调用时的注册费；调用方必须以 `registerRelay` 执行时适用的当前费用为准，不得把查询结果缓存为固定注册费。

### 调用参数

无。

### 返回值

返回 `Integer`，表示以 GAS 最小单位计量的当前注册费；`0` 表示免费注册。GAS 使用 8 位小数，因此返回整数 `10000000000` 表示 `100 GAS`。

## `registerRelay`

`registerRelay` 用于首次建立公共中继的 [`RelayEntry`](core-objects.md#relayentry)。它只供公共中继运营者使用，不用于普通用户账户的建立或使用；调用交易必须包含 `relayId` witness。

本方法按合约执行时的当前注册费收费。当前注册费为 `0` 时不收费；大于 `0` 时，合约从 `relayId` 收取该整数所表示的 GAS 金额。

### 调用参数

| 参数 | ABI 类型 | 约束 |
|---|---|---|
| `relayId` | `UInt160` | 标识要注册的中继；Registry 中不得已有该中继的记录 |
| `endpoint` | `String` | 必须满足 [`RelayEntry`](core-objects.md#relayentry) 对发现入口的全部约束 |

### 返回值

满足全部参数、witness 和费用条件时，合约创建 `status` 为 `active` 的 `RelayEntry`，并返回 `Boolean` 值 `true`。

参数类型或取值不合法、注册费支付失败时调用失败；授权不足或中继已注册时返回 `false`，不更改记录，也不收取注册费。

## `updateRelayEndpoint`

`updateRelayEndpoint` 供已注册的公共中继运营者更新中继记录的发现入口。调用交易必须包含 `relayId` witness。更新不改变 `status`。

### 调用参数

| 参数 | ABI 类型 | 约束 |
|---|---|---|
| `relayId` | `UInt160` | 标识要更新发现入口的中继；Registry 中必须已有该中继的记录 |
| `endpoint` | `String` | 必须满足 [`RelayEntry`](core-objects.md#relayentry) 对发现入口的全部约束 |

### 返回值

校验通过后，按原字符串值比较 `endpoint`：相同则保持整条记录不变；不同则更新 `endpoint` 和 `updated_at`。两种情况均返回 `Boolean` 值 `true`。

授权不足或目标记录不存在时返回 `false`，且不更改记录。参数类型或取值不合法时调用失败。

## `setRelayEnabled`

`setRelayEnabled` 供已注册的公共中继运营者启用或停用中继成员资格。调用交易必须包含 `relayId` witness。

### 调用参数

| 参数 | ABI 类型 | 约束 |
|---|---|---|
| `relayId` | `UInt160` | 标识要启用或停用成员资格的中继；Registry 中必须已有该中继的记录 |
| `enabled` | `Boolean` | `true` 表示运营者请求启用中继成员资格，`false` 表示运营者请求停用中继成员资格 |

### 返回值

校验通过后，请求状态与当前状态相同时，保持整条记录不变；否则将 `status` 设为 `active` 或 `disabled`，并更新 `updated_at`。两种情况均返回 `Boolean` 值 `true`。

授权不足、目标记录不存在或成员资格已被 Registry 治理方暂停时，返回 `false` 且不更改记录。参数类型或取值不合法时调用失败。
