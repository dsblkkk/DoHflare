![DoHflare 横幅图片](docs/public/social-card.jpg)

<p align="right">
  <b>简体中文</b> | <a href="./README.en.md">English</a>
</p>

# DoHflare

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflareworkers&logoColor=white) ![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflarepages&logoColor=white) ![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue)

DoHflare 是一个为 Cloudflare Workers 和 Pages 构建的高性能 DNS over HTTPS（DoH）边缘代理。作为私有 DNS 解析器，它能对 TTL 进行管理、支持 EDNS0 客户端子网（ECS）以提升解析质量，并通过双层缓存机制对流量进行控制。

> [!IMPORTANT]
> 本 README 仅涵盖基本部署和设置。有关完整的配置指南以及中国大陆地区优化建议等，请访问 **[官方文档](https://dohflare.racpast.com/docs)**。

## 🚀 部署

### 方案 A：Cloudflare Workers（手动）

1. **创建应用程序**：登录 [Cloudflare 控制面板](https://dash.cloudflare.com)，进入 **Workers 和 Pages** → **创建应用程序**。
2. **初始化**：在 **Ship something new** 区域，选择 **从 Hello World! 开始**，为您的 Worker 命名，然后点击 **部署**。
3. **更新代码**：点击 **编辑代码**，将 **[`src/_worker.js`](https://raw.githubusercontent.com/Racpast/DoHflare/main/src/_worker.js)** 的原始内容粘贴进去。
4. **添加自定义域**：进入 **设置** → **域和路由**，添加您的自定义域名。

### 方案 B：Cloudflare Pages（直接上传）

1. **下载源码**：[下载](https://dohflare.racpast.com/DoHflare-main.zip) 并解压仓库的 ZIP 压缩包。
2. **开始 Pages 部署**：在 Cloudflare 控制面板中，进入 **Workers 和 Pages** → **创建应用程序**。
3. **启动上传**：点击页面底部的 **想要部署 Pages？** 旁边的 **开始使用**。
4. **上传资产**：在 **拖放文件** 区域，点击 **开始使用**。
5. **创建项目**：为项目命名，点击 **创建项目**，选择上传 **文件夹**，然后选中解压后的 `src` 目录。点击 **部署站点**。
6. **添加自定义域**：在 **自定义域** 标签页中配置您的域名。

## 🛠️ 浏览器配置

自定义域名设置完成后，请使用您的端点 URL（例如 `https://yourdomain.com/dns-query`）更新浏览器的安全 DNS 设置：

### Google Chrome

1. 导航至 `chrome://settings/security`。
2. 开启 **使用安全 DNS**。
3. 在 **选择 DNS 提供商** 下拉菜单中，选择 **添加自定义 DNS 服务提供商**，然后输入您的端点 URL。

### Microsoft Edge

1. 导航至 `edge://settings/privacy/security`。
2. 开启 **使用安全的 DNS**。
3. 选择 **请选择服务提供商**，然后输入您的端点 URL。

## ⚙️ 运行时配置

运行时行为通过在 Cloudflare 控制面板的 **设置** → **变量和机密** 中配置环境变量进行控制。

| 变量                            | 默认值                                                       | 描述                                                         |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `UPSTREAM_URLS`                 | `https://dns.google/dns-query,https://dns11.quad9.net/dns-query` | 以逗号分隔的上游 DoH 解析器列表。                                |
| `DOH_PATH`                      | `/dns-query`                                                 | DoH 请求的监听 URI 路径。                                    |
| `ROOT_CONTENT`                  | *（生成的 HTML）*                                            | 在 `/` 路径提供服务的自定义 HTML 内容。                      |
| `ROOT_CACHE_TTL`                | `86400`                                                      | 根页面的生存时间（秒）。                                     |
| `MAX_RETRIES`                   | `2`                                                          | 上游请求失败时的最大重试次数。                               |
| `DEFAULT_POSITIVE_TTL`          | `60`                                                         | 成功解析但未提供 TTL 时应用的默认 TTL（秒）。                |
| `DEFAULT_NEGATIVE_TTL`          | `15`                                                         | NXDOMAIN 或解析失败时应用的默认 TTL（秒）。                  |
| `FALLBACK_ECS_IP`               | `119.29.29.0`                                                | 客户端 IP 无法解析时为 EDNS 客户端子网注入的默认 IP 地址。   |

完整的变量定义可在[配置指南](https://dohflare.racpast.com/docs/configuration)中查看。

## ⚖️ 许可证与合规性

采用 **GNU Affero 通用公共许可证 v3.0（AGPL-3.0）** 进行许可。

**附加声明**：根据 GNU AGPLv3 第 7 节的规定，关于署名和合规性的附加条款适用。请参阅仓库中的 `NOTICE` 和 `LICENSE` 文件。

**版权所有 © 2026 Racpast。保留所有权利。**