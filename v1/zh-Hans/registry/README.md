# 中继注册表

[Meshline Protocol 1.0](../README.md)

中继注册表是 Meshline 网络用于公布公共中继成员记录的链上目录。客户端和中继从中取得候选中继的 `relay_id`、初始 HTTPS endpoint 和当前成员资格状态。服务身份由 [`RelayDescriptor`](../client-relay/core-objects/relay-descriptor.md#relaydescriptor) 绑定，通过 HTTPS 发现接口或[中继 Noise 握手](../relay-dht/concepts/connection-and-authentication.md)取得后，结合 Registry 当前记录验证。

当前 Neo N3 中继注册表合约名为 `MeshlineRegistry`。本文后续简称其为 Registry。

本协议定义 Meshline Protocol 1.0 互操作所需的 Registry 数据结构、公开 ABI 和可观察行为。具体合约可以另外公开部署生命周期、合约验证、升级、治理、付款回调或事件等实现接口；除非这些接口也在本协议列出，否则它们不构成其他兼容 Registry 实现必须提供的 ABI。Neo N3 参考合约的源码见[合约仓库](https://github.com/meshline-network/contracts)，完整接口说明见 [ABI 文档](https://github.com/meshline-network/contracts/blob/main/docs/abi.md)。

账户路由由[AccountRoute 与中继资源 DHT](../relay-dht/core-objects.md#accountroute)定义的签名文档和 DHT 提供；Registry 只负责公共中继成员目录。

## 参与方与信任边界

Registry 方法通过可信[网络上下文](../general.md#网络上下文)指定的 Registry 合约地址调用 Neo N3 合约 ABI。

公共中继运营者以中继 Neo 账户调用注册和记录维护方法；客户端与其他中继只读取 Registry 的公开状态。Registry 的链上共识状态是中继成员资格的权威来源，endpoint 的协议身份、描述符有效期和服务能力还须按 [`RelayDescriptor` 验证规则](../client-relay/core-objects/relay-descriptor.md#中继描述符验证规则)确认。

Registry 不证明某个中继当前可达，也不授权用户账户、消息或账户路由。治理如何改变费用或暂停成员不属于公开协议 ABI；实现只依赖这些操作产生的可观察 `RelayEntry` 状态。

## 协议内容

| 部分 | 内容 |
|---|---|
| [核心对象](core-objects.md) | `relay_id` 与 `RelayEntry` 的权威结构和状态语义 |
| [方法](methods.md) | 公开查询、中继注册与记录维护 |

## 一致性要求

兼容实现必须保持本协议列出的公开 ABI、参数顺序、返回结构和可观察状态语义。调用方不得依赖本协议未列出的便利查询接口完成互操作。
