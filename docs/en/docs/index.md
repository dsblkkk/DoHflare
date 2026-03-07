---
title: Introduction
---
![DoHflare Banner](/social-card.jpg)

# DoHflare

<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 24px;">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflareworkers&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflarepages&logoColor=white" alt="Cloudflare Pages">
  <img src="https://img.shields.io/badge/License-AGPL%20v3-blue" alt="License: AGPL v3">
</div>

DoHflare is a high-performance DNS over HTTPS (DoH) edge proxy built for Cloudflare Workers and Pages. As a private DNS resolver, it manages TTL, supports EDNS0 Client Subnet (ECS) to improve resolution quality, and controls traffic through a dual-layer caching mechanism.

## Project Structure

```text
.
├── docs/                  # Documentation site source (VitePress)
├── src/
│   └── _worker.js         # Core Worker script
├── .gitignore             # Git ignore rules
├── LICENSE                # GNU AGPLv3 license
├── NOTICE                 # Additional terms and attribution notice
├── package.json           # Project metadata and dependency configuration
├── README.md              # Main documentation (Chinese)
├── README.en.md           # Main documentation (English)
├── SECURITY.md            # Security policy and vulnerability reporting guide
└── wrangler.jsonc         # Wrangler CLI configuration
```
