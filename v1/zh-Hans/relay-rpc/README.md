# 中继 RPC 协议

[Meshline Protocol 1.0](../README.md)

libp2p protocol ID：`/meshline/relay/1.0.0`

本协议定义合格公共中继之间的直接账户查询和跨中继消息投递。消息不沿 DHT 查询路径逐跳转发；源中继解析当前账户路由后，直接连接目标归属中继。源中继和目标中继的含义遵循客户端—中继协议的[角色定义](../client-relay/concepts/roles-and-routing.md#角色)。

连接、远端响应、缓存和传输网络都不属于用户信任根；无法通过签名、路由和对象验证的响应不得转交客户端。

## 协议内容

| 部分 | 内容 |
|---|---|
| [方法公共约定](methods/conventions.md) | 流内消息分帧、JSON-RPC 请求与响应、目标路由、错误和资源控制 |
| [账户查询方法](methods/account-queries.md) | 设备授权状态、完整设备状态和账户资料查询 |
| [消息投递方法](methods/message-delivery.md) | 跨中继消息投递的授权、验证、时间线写入与幂等结果 |
| [中继 RPC 通知](notifications/README.md) | 设备证书状态缓存失效提示 |

## 方法索引

- [`device.status`](methods/account-queries.md#devicestatus)
- [`device.state.resolve`](methods/account-queries.md#devicestateresolve)
- [`profile.resolve`](methods/account-queries.md#profileresolve)
- [`message.deliver`](methods/message-delivery.md#messagedeliver)

## 通知索引

- [`device.status.changed`](notifications/README.md#devicestatuschanged)

## 一致性要求

兼容实现须遵循[一致性测试边界](../test-vectors/README.md#一致性测试边界)，并覆盖：

- 连接与传输：按[方法公共约定](methods/conventions.md)验证 Peer 身份、长度前缀及接收上限、JSON-RPC 封装、目标选择、路由刷新和错误恢复；消息分帧失败关闭或 reset stream，不构造应用层响应。
- 查询与通知：按[账户查询方法](methods/account-queries.md)及[中继 RPC 通知](notifications/README.md)验证设备状态与失效提示、跨中继响应的账户和签名绑定，以及公开资料与受限设备查询的权限区别；未经验证的远端响应不得作为成功结果转交客户端。
- 可靠投递：按 [`message.deliver`](methods/message-delivery.md#messagedeliver) 验证收件授权、完整参数幂等、结果保留、响应丢失、路由迁移及重启后的投递与结果确认。
