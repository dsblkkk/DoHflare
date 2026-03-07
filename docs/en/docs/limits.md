# Platform Limits & Constraints

DoHflare's performance is bound by the execution limits of the Cloudflare Workers platform. Please ensure your deployment tier aligns with your expected traffic volume.

| Resource                  | Workers Free   | Workers Paid      | Impact on DoHflare                                           |
| ------------------------- | -------------- | ----------------- | ------------------------------------------------------------ |
| **Requests per day**      | 100,000        | No limit          | Proxy will return HTTP 429 once limit is reached.            |
| **CPU Time per request**  | 10 ms          | 5 min             | DNS parsing is lightweight; 10ms is typically more than sufficient. |
| **Subrequests (fetch)**   | 50 per request | 10000 per request | DoHflare strictly manages upstream retries, staying well below limits. |
| **Cache API Object Size** | 512 MB         | 512 MB            | Safely capped by `MAX_CACHEABLE_BYTES` (default 64KB).       |

*For complete and up-to-date limits, refer to the [Cloudflare Workers Limits Documentation](https://developers.cloudflare.com/workers/platform/limits).*
