# Error Codes & Status Mapping

DoHflare relies on standard HTTP status codes combined with custom headers (`X-DOHFLARE-Code`) for precise debugging without breaking the DNS payload format.

| HTTP Status                  | Internal Code    | Description                                                  |
| ---------------------------- | ---------------- | ------------------------------------------------------------ |
| `200 OK`                     | N/A              | Successful resolution (Cache HIT or MISS).                   |
| `400 Bad Request`            | N/A              | Missing `dns` parameter, invalid Base64URL, or malformed DNS query. |
| `405 Method Not Allowed`     | N/A              | Request method is not `GET`, `POST`, or `OPTIONS`.           |
| `413 Payload Too Large`      | N/A              | POST body exceeds `MAX_POST_BODY_BYTES`.                     |
| `415 Unsupported Media Type` | N/A              | Missing or invalid `Content-Type` header in POST request.    |
| `502 Bad Gateway`            | `UPSTREAM_ERR`   | Upstream resolvers are unreachable or returned an invalid response. |
| `500 Internal Server Error`  | `INTERNAL_FATAL` | Unhandled exception during payload parsing or cache writing. |

**Internal Parsing Errors (Captured in logs):**

* `OOB_READ`: Attempted to read out-of-bounds memory in the ArrayBuffer.
* `MALFORMED_LOOP`: Detected an infinite pointer loop in the DNS name compression scheme.
* `PAYLOAD_TOO_LARGE`: Upstream response exceeded `MAX_CACHEABLE_BYTES`.
