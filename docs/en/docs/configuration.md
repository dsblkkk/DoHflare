# Configuration

All runtime behaviors are controlled via environment variables defined in the `vars` block of `wrangler.jsonc` or via the Cloudflare Dashboard. The script includes hardcoded fallback defaults; you only need to assign a variable if you intend to override the default value.

## Environment Variables Reference

| Variable                        | Default Value                                                | Description                                                  |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `UPSTREAM_URLS`                 | `https://dns.google/dns-query,https://dns11.quad9.net/dns-query` | Comma-separated list of upstream DoH resolvers.                        |
| `DOH_PATH`                      | `/dns-query`                                                 | The listening URI path for DoH requests.                     |
| `DOH_CONTENT_TYPE`              | `application/dns-message`                                    | Expected MIME type for DNS payloads.                         |
| `ROOT_CONTENT`                  | *(Generated HTML)*                                           | Custom HTML content to serve at the `/` path.                |
| `ROOT_CONTENT_TYPE`             | `text/html; charset=utf-8`                                   | MIME type for the root path response.                        |
| `ROOT_CACHE_TTL`                | `86400`                                                      | Time-to-live (in seconds) for the root landing page.         |
| `MAX_CACHEABLE_BYTES`           | `65536`                                                      | Maximum byte size for caching a DNS response.                |
| `MAX_POST_BODY_BYTES`           | `8192`                                                       | Maximum byte size allowed for incoming POST requests.        |
| `FETCH_TIMEOUT_MS`              | `2500`                                                       | Timeout limit (in milliseconds) for upstream fetch operations. |
| `MAX_RETRIES`                   | `2`                                                          | Maximum number of retry attempts for failed upstream requests. |
| `DEFAULT_POSITIVE_TTL`          | `60`                                                         | Default TTL (in seconds) applied to successful resolutions if none is provided. |
| `DEFAULT_NEGATIVE_TTL`          | `15`                                                         | Default TTL (in seconds) applied to NXDOMAIN or failed resolutions. |
| `FALLBACK_ECS_IP`               | `119.29.29.0`                                                | Default IP address injected for EDNS Client Subnet if the client IP is unresolvable. |
| `CF_CACHE_WRITE_THRESHOLD`      | `500`                                                        | Probability threshold (out of 10000) for writing responses to the Cloudflare global cache. |
| `GLOBAL_WRITE_COOLDOWN_MS`      | `300000`                                                     | Minimum interval (in milliseconds) required between global cache writes for the same key. |
| `GLOBAL_WRITE_PER_MINUTE_LIMIT` | `200`                                                        | Maximum number of global cache writes allowed per minute across the isolate. |
| `GLOBAL_CACHE_NAMESPACE`        | `https://dohflare.local/cache/`                              | The dummy URL namespace used for isolating objects in the Cloudflare Cache API. |
| `HOT_WINDOW_MS`                 | `60000`                                                      | Time window (in milliseconds) to track request frequency for L1 hot cache promotion. |
| `HOT_HIT_THRESHOLD`             | `20`                                                         | Minimum number of hits within the hot window to trigger an immediate global cache write. |
| `STALE_WINDOW_FACTOR`           | `0.5`                                                        | Multiplier applied to the TTL to determine the acceptable stale-while-revalidate window. |
| `EXTREME_STALE_FALLBACK_MS`     | `86400000`                                                   | Maximum time (in milliseconds) to serve stale cache data if all upstream requests fail. |
| `JITTER_PCT`                    | `10`                                                         | Percentage of deterministic jitter applied to TTLs to mitigate cache stampedes. |
