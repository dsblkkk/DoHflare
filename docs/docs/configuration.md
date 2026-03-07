# 配置

所有运行时行为都通过 `wrangler.jsonc` 的 `vars` 块中定义的环境变量或通过 Cloudflare 仪表板进行控制。脚本包含了硬编码的回退默认值；只有当您打算覆盖默认值时，才需要设置变量。

## 环境变量参考表

| 变量                            | 默认值                                                       | 描述                                                         |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `UPSTREAM_URLS`                 | `https://dns.google/dns-query,https://dns11.quad9.net/dns-query` | 以逗号分隔的上游 DoH 解析器列表。                                |
| `DOH_PATH`                      | `/dns-query`                                                 | DoH 请求的监听 URI 路径。                                    |
| `DOH_CONTENT_TYPE`              | `application/dns-message`                                    | DNS 负载的预期 MIME 类型。                                   |
| `ROOT_CONTENT`                  | *（生成的 HTML）*                                            | 在 `/` 路径提供服务的自定义 HTML 内容。                      |
| `ROOT_CONTENT_TYPE`             | `text/html; charset=utf-8`                                   | 根路径响应的 MIME 类型。                                     |
| `ROOT_CACHE_TTL`                | `86400`                                                      | 根页面的生存时间（秒）。                                     |
| `MAX_CACHEABLE_BYTES`           | `65536`                                                      | 缓存 DNS 响应的最大字节数。                                  |
| `MAX_POST_BODY_BYTES`           | `8192`                                                       | 允许的传入 POST 请求的最大字节数。                           |
| `FETCH_TIMEOUT_MS`              | `2500`                                                       | 上游 fetch 操作的超时限制（毫秒）。                          |
| `MAX_RETRIES`                   | `2`                                                          | 上游请求失败时的最大重试次数。                               |
| `DEFAULT_POSITIVE_TTL`          | `60`                                                         | 成功解析但未提供 TTL 时应用的默认 TTL（秒）。                |
| `DEFAULT_NEGATIVE_TTL`          | `15`                                                         | NXDOMAIN 或解析失败时应用的默认 TTL（秒）。                  |
| `FALLBACK_ECS_IP`               | `119.29.29.0`                                                | 客户端 IP 无法解析时为 EDNS 客户端子网注入的默认 IP 地址。   |
| `CF_CACHE_WRITE_THRESHOLD`      | `500`                                                        | 将响应写入 Cloudflare 全局缓存的概率阈值（分母为 10000）。   |
| `GLOBAL_WRITE_COOLDOWN_MS`      | `300000`                                                     | 同一键的全局缓存写入所需的最小间隔（毫秒）。                 |
| `GLOBAL_WRITE_PER_MINUTE_LIMIT` | `200`                                                        | 隔离环境中每分钟允许的全局缓存写入最大次数。                 |
| `GLOBAL_CACHE_NAMESPACE`        | `https://dohflare.local/cache/`                              | 用于在 Cloudflare 缓存 API 中隔离对象的虚拟 URL 命名空间。   |
| `HOT_WINDOW_MS`                 | `60000`                                                      | 跟踪 L1 热缓存请求频率的时间窗口（毫秒）。                   |
| `HOT_HIT_THRESHOLD`             | `20`                                                         | 在热窗口内触发立即全局缓存写入所需的最小命中次数。           |
| `STALE_WINDOW_FACTOR`           | `0.5`                                                        | 应用于 TTL 的乘数，用于确定可接受的“过时-同时-重新验证”窗口。 |
| `EXTREME_STALE_FALLBACK_MS`     | `86400000`                                                   | 所有上游请求失败时，提供过时缓存数据的最大时间（毫秒）。     |
| `JITTER_PCT`                    | `10`                                                         | 应用于 TTL 的确定性抖动百分比，用于减轻缓存雪崩效应。        |
