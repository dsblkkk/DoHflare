---
layout: home

hero:
  name: "DoHflare"
  text: "Cloudflare <span id='typed-text'>Workers</span> DoH 代理"
  tagline: 地表最强实现 · 双层缓存 · TTL 抖动 · ECS 注入
  actions:
    - theme: brand
      text: 快速开始
      link: /docs/
    - theme: alt
      text: GitHub
      link: https://github.com/racpast/DoHflare

features:
  - icon: ⚡️
    title: 多级缓存
    details: 集成 L1 隔离内存缓存与 L2 分布式全局缓存，严格遵循 TTL 约束，大幅降低上游解析延迟。
  - icon: 📍
    title: 精准路由
    details: 完整支持 ECS，按标准截断后注入请求，在保障隐私的同时引导 CDN 返回最优节点 IP，显著提升中国大陆等复杂网络环境下的解析质量与访问速度。
  - icon: 🌐
    title: 弹性缓存
    details: 通过抗碰撞的 FNV-1a 哈希分散缓存键，结合确定性 TTL 抖动算法，防止大量缓存同时过期冲击上游，确保高并发下缓存系统稳定高效。
  - icon: 🚦
    title: 流量控制
    details: 通过请求合并、负载大小验证与全局写入速率限制，有效防止上游过载和协议滥用，确保服务稳定。
---

<script setup>
import { useTypewriter } from './.vitepress/theme/useTypewriter'
useTypewriter()
</script>
