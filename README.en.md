![DoHflare Banner](docs/public/social-card.jpg)

<p align="right">
  <a href="./README.md">简体中文</a> | <b>English</b>
</p>

# DoHflare

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflareworkers&logoColor=white) ![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflarepages&logoColor=white) ![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue)

DoHflare is a high-performance DNS over HTTPS (DoH) edge proxy built for Cloudflare Workers and Pages. As a private DNS resolver, it manages TTL, supports EDNS0 Client Subnet (ECS) to improve resolution quality, and controls traffic through a dual-layer caching mechanism.

> [!IMPORTANT]
> This README only covers basic deployment and setup. For the complete configuration guide and more, please visit the **[Official Documentation](https://dohflare.racpast.com/en/docs)**.

## 🚀 Deployment

### Option A: Cloudflare Workers (Manual)

1. **Create Application**: Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com) and navigate to **Workers & Pages** → **Create application**.
2. **Initialize**: Under the **Ship something new** section, select **Start with Hello World!**, name your worker, and click **Deploy**.
3. **Update Code**: Click **Edit code** and paste the raw contents of **[`src/_worker.js`](https://raw.githubusercontent.com/Racpast/DoHflare/main/src/_worker.js)**.
4. **Add Custom Domain**: Navigate to **Settings** → **Domains & Routes** and add your custom domain.

### Option B: Cloudflare Pages (Direct Upload)

1. **Download Source**: [Download](https://github.com/racpast/DoHflare/archive/refs/heads/main.zip) and extract the repository ZIP.
2. **Start Pages Deployment**: In the Cloudflare Dashboard, navigate to **Workers & Pages** → **Create application**.
3. **Initiate Upload**: Click **Get started** next to "Looking to deploy Pages?" at the bottom of the page.
4. **Upload Assets**: Under the **Drag and drop your files** section, click **Get started**.
5. **Create Project**: Name the project, click **Create project**, choose to upload a **folder**, and select the extracted `src` directory. Click **Deploy site**.
6. **Add Custom Domain**: Configure your domain under the **Custom domains** tab.

## 🛠️ Browser Configuration

Once your custom domain is set up, update your browser's Secure DNS settings using your Endpoint URL (e.g., `https://yourdomain.com/dns-query`):

### Google Chrome

1. Navigate to `chrome://settings/security`.
2. Turn on **Use secure DNS**.
3. In the **Select DNS provider** dropdown, choose **Add custom DNS service provider** and enter your Endpoint URL.

### Microsoft Edge

1. Navigate to `edge://settings/privacy/security`.
2. Turn on **Use secure DNS**.
3. Select **Choose a service provider** and enter your Endpoint URL.

## ⚙️ Runtime Configuration

Runtime behaviors are controlled via environment variables in the Cloudflare Dashboard under **Settings** → **Variables and Secrets**.

| Variable                        | Default Value                                                | Description                                                  |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `UPSTREAM_URLS`                 | `https://dns.google/dns-query,https://dns11.quad9.net/dns-query` | Comma-separated list of upstream DoH resolvers.                        |
| `DOH_PATH`                      | `/dns-query`                                                 | The listening URI path for DoH requests.                     |
| `DOH_CONTENT_TYPE`              | `application/dns-message`                                    | Expected MIME type for DNS payloads.                         |
| `ROOT_CONTENT`                  | *(Generated HTML)*                                           | Custom HTML content to serve at the `/` path.                |
| `ROOT_CACHE_TTL`                | `86400`                                                      | Time-to-live (in seconds) for the root landing page.         |
| `MAX_RETRIES`                   | `2`                                                          | Maximum number of retry attempts for failed upstream requests. |
| `DEFAULT_POSITIVE_TTL`          | `60`                                                         | Default TTL (in seconds) applied to successful resolutions if none is provided. |
| `DEFAULT_NEGATIVE_TTL`          | `15`                                                         | Default TTL (in seconds) applied to NXDOMAIN or failed resolutions. |
| `FALLBACK_ECS_IP`               | `119.29.29.0`                                                | Default IP address injected for EDNS Client Subnet if the client IP is unresolvable. |

Full variable definitions are available in the [Configuration Guide](https://dohflare.racpast.com/en/docs/configuration).

## ⚖️ License & Compliance

Licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**ADDITIONAL NOTICE**: Pursuant to Section 7 of the GNU AGPLv3, additional terms apply regarding attribution and compliance. Refer to the `NOTICE` and `LICENSE` files in the repository.

**Copyright © 2026 Racpast. All rights reserved.**
