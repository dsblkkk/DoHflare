# 错误代码与状态映射

DoHflare 依赖于标准 HTTP 状态码，并结合自定义头部（`X-DOHFLARE-Code`）进行精确调试，同时不破坏 DNS 负载格式。

| HTTP 状态码                  | 内部代码         | 描述                                                      |
| ---------------------------- | ---------------- | --------------------------------------------------------- |
| `200 OK`                     | 无               | 成功解析（缓存命中或未命中）。                            |
| `400 Bad Request`            | 无               | 缺少 `dns` 参数、无效的 Base64URL 或格式错误的 DNS 查询。 |
| `405 Method Not Allowed`     | 无               | 请求方法不是 `GET`、`POST` 或 `OPTIONS`。                 |
| `413 Payload Too Large`      | 无               | POST 请求体超过 `MAX_POST_BODY_BYTES`。                   |
| `415 Unsupported Media Type` | 无               | POST 请求中缺少或无效的 `Content-Type` 头部。             |
| `502 Bad Gateway`            | `UPSTREAM_ERR`   | 上游解析器无法访问或返回了无效响应。                      |
| `500 Internal Server Error`  | `INTERNAL_FATAL` | 在负载解析或缓存写入期间发生未处理的异常。                |

**内部解析错误（记录在日志中）：**

* `OOB_READ`: 尝试在 ArrayBuffer 中进行越界读取。
* `MALFORMED_LOOP`: 在 DNS 名称压缩方案中检测到无限指针循环。
* `PAYLOAD_TOO_LARGE`: 上游响应超过 `MAX_CACHEABLE_BYTES`。
