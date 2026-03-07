# 平台限制与约束

DoHflare 的性能受 Cloudflare Workers 平台执行限制的约束。请确保您的部署层级与预期流量规模相匹配。

| 资源                    | Workers 免费版 | Workers 付费版    | 对 DoHflare 的影响                              |
| ----------------------- | -------------- | ----------------- | ----------------------------------------------- |
| **每日请求数**          | 100,000        | 无限制            | 一旦达到限制，代理将返回 HTTP 429。             |
| **每个请求的 CPU 时间** | 10 毫秒        | 5 分钟            | DNS 解析是轻量级的；10 毫秒通常绰绰有余。       |
| **子请求（fetch）**     | 每个请求 50 次 | 每个请求 10000 次 | DoHflare 严格管理上游重试，远低于限制。         |
| **缓存 API 对象大小**   | 512 MB         | 512 MB            | 由 `MAX_CACHEABLE_BYTES`（默认 64KB）安全限制。 |

*有关完整和最新的限制信息，请参考 [Cloudflare Workers 限制文档](https://developers.cloudflare.com/workers/platform/limits)。*
