---
title: 项目介绍
---
![DoHflare Banner](/social-card.jpg)

# DoHflare

<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 24px;">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflareworkers&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflarepages&logoColor=white" alt="Cloudflare Pages">
  <img src="https://img.shields.io/badge/License-AGPL%20v3-blue" alt="License: AGPL v3">
</div>

DoHflare 是一个为 Cloudflare Workers 和 Pages 构建的高性能 DNS over HTTPS（DoH）边缘代理。作为私有 DNS 解析器，它能对 TTL 进行管理、支持 EDNS0 客户端子网（ECS）以提升解析质量，并通过双层缓存机制对流量进行控制。

## 项目结构

```text
.
├── docs/                  # 项目文档站点（VitePress）
├── src/
│   └── _worker.js         # Worker 核心脚本代码
├── .gitignore             # Git 忽略规则
├── LICENSE                # GNU AGPLv3 开源许可证
├── NOTICE                 # 附加条款与代码归属声明
├── package.json           # 项目元数据与依赖配置
├── README.md              # 中文说明文档
├── README.en.md           # English README
├── SECURITY.md            # 安全策略与漏洞报告
└── wrangler.jsonc         # Wrangler 部署配置
```
