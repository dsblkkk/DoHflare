---
layout: home

hero:
  name: "DoHflare"
  text: "Cloudflare <span id='typed-text'>Workers</span> DoH Proxy"
  tagline: The Ultimate Implementation · Dual-Layer Caching · TTL Jitter · ECS Injection
  actions:
    - theme: brand
      text: Quick Start
      link: /en/docs/
    - theme: alt
      text: GitHub
      link: https://github.com/racpast/DoHflare

features:
  - icon: ⚡️
    title: Multi-Tiered Caching
    details: Combines L1 isolated in-memory caching with L2 distributed global storage. Strictly enforces TTL constraints to slash upstream resolution latency and maximize responsiveness.
  - icon: 📍
    title: Precision Traffic Steering
    details: Full EDNS0 Client Subnet (ECS) support with privacy-preserving truncation. Directs CDNs to serve the optimal edge node IPs, dramatically improving resolution quality in complex network regions.
  - icon: 🌐
    title: Resilient Cache Logic
    details: Distributes cache keys via collision-resistant FNV-1a hashing. Paired with deterministic TTL jitter, it prevents cache stampedes and ensures rock-solid efficiency under high-concurrency loads.
  - icon: 🚦
    title: Intelligent Traffic Shaping
    details: Mitigates upstream overload and protocol abuse through request coalescing, payload validation, and global write-rate limiting, guaranteeing sustained service stability.
---

<script setup>
import { useTypewriter } from '../.vitepress/theme/useTypewriter'
useTypewriter()
</script>
