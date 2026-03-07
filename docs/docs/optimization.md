# 中国大陆网络环境特别优化指南

鉴于中国大陆特殊的网络环境，直接连接 Cloudflare 的 Anycast 节点可能导致高延迟甚至连接重置。为获得极致的 DoH 解析体验，强烈建议中国大陆用户采用 **“自定义域名 + 特征伪装 + CNAME 优选”** 的进阶部署方案。下文将详细介绍各步骤的实施方法。

::: tip 随机域名生成建议
为最大程度规避特征检测，建议使用无连字符的 UUID 作为子域名，例如 `8dc76a899f244efa89793c55367b0930.example.com`。您可以通过 [uuid.rpnet.cc](https://uuid.rpnet.cc) 快速生成此类随机字符串。本文所有示例均基于此随机域名展开。
:::

## 一、主动防御与特征伪装

GFW 会对域名中包含 `doh` 等敏感关键词的子域进行 SNI 嗅探与主动阻断。在绑定自定义域名前，请务必完成以下伪装工作：

1. **规避敏感域名**：切勿使用如 `doh.example.com` 这类包含 `doh` 的子域名。请使用随机生成的字符串或无特定含义的词汇（例如上述 UUID 示例）。
2. **修改默认路径**：在 Cloudflare 环境变量中，将默认的 `DOH_PATH`（`/dns-query`）更改为无特征路径（例如 `/auth-verify` 或 `/query`）。
3. **注入 Nginx 伪装页面**：为防止 GFW 的主动探测爬虫通过访问根目录暴露 DoH 代理特征，请在环境变量中添加 `ROOT_CONTENT`，并填入以下标准的 Nginx 默认欢迎页 HTML 代码，使根目录呈现为一个普通的 Nginx 未配置站点：

```html
<!DOCTYPE html><html><head><title>Welcome to nginx!</title><style>html { color-scheme: light dark; } body { width: 35em; margin: 0 auto; font-family: Tahoma, Verdana, Arial, sans-serif; }</style></head><body><h1>Welcome to nginx!</h1><p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p><p>For online documentation and support please refer to <a href="http://nginx.org/">nginx.org</a>.<br/>Commercial support is available at <a href="http://nginx.com/">nginx.com</a>.</p><p><em>Thank you for using nginx.</em></p></body></html>
```

## 二、将子域名托管至华为云 DNS

为实现境内外流量的分线路解析，需要将您选定的子域名（例如 `8dc76a899f244efa89793c55367b0930.example.com`）的 DNS 解析权完全交给支持地域解析的第三方平台（以华为云 DNS 为例）。

1. **在华为云添加子域名作为独立 DNS 区域** 
   注册并登录华为云，进入 **云解析服务 DNS**，点击 **添加公网域名**。在弹出的对话框中，于 **域名** 输入框中输入您的完整子域名（如 `8dc76a899f244efa89793c55367b0930.example.com`），点击 **确定** 完成添加。

2. **在上级 DNS 服务商处设置 NS 记录**
   前往您主域名（`example.com`）当前使用的 DNS 服务商控制台（可能是域名注册商，也可能是 Cloudflare DNS），为您的子域名添加以下四条 NS 记录，将解析权委派给华为云：
   
   - 主机记录：填写您的子域名前缀（例如 `8dc76a899f244efa89793c55367b0930`）  
   - 记录类型：`NS`  
   - 记录值：依次为华为云的四条公网 DNS 服务器地址：
     - `ns1.huaweicloud-dns.com`
     - `ns1.huaweicloud-dns.cn`
     - `ns1.huaweicloud-dns.net`
     - `ns1.huaweicloud-dns.org`
   
   保存后，等待全球 DNS 生效。此后，该子域名及其所有子记录的解析将完全由华为云控制。

## 三、建立默认解析线路

在华为云 DNS 中，我们需要先为子域名添加一条 **“全网默认”线路的 CNAME 记录**，将请求指向 Cloudflare 分配的默认域名。这条记录的作用是让 Cloudflare 能够验证域名的所有权并建立请求路由，确保后续优选配置能够生效。

### 方案 A：Workers 部署

::: warning 注意
使用本方案要求主域名（如 `example.com`）必须已托管在 Cloudflare 且状态为“活动”，否则无法完成路由绑定。
:::

- **华为云侧配置**：在子域名的 DNS 记录中，添加一条 CNAME 记录：
  - 主机记录：**留空**（或填写 `@`）
  - 记录类型：`CNAME`
  - 线路类型：**全网默认**
  - 记录值：您的 Worker 默认域名（例如 `your-worker.your-subdomain.workers.dev`）
- **Cloudflare 侧配置**：在 Cloudflare 仪表板中，进入 **Workers 和 Pages**，进入您的 DoHflare Worker 详情页，点击 **设置** 选项卡，在 **域和路由** 部分的标题右侧点击 **添加** 按钮，在弹出的侧边栏中选择 **路由**。然后在出现的页面中，在 **区域** 下拉框中选择您的域名（例如 `example.com`），在 **路由** 输入框中填写 `8dc76a899f244efa89793c55367b0930.example.com/*`，点击 **添加路由** 保存。

### 方案 B：Pages 部署
- **华为云侧配置**：同样添加一条 **全网默认** 线路的 CNAME 记录，记录值填写您的 Pages 默认域名（例如 `your-project.pages.dev`），主机记录 **留空**（或填写 `@`）。
- **Cloudflare 侧配置**：进入 Pages 项目详情页的 **自定义域** 选项卡，点击 **设置自定义域**，输入 `8dc76a899f244efa89793c55367b0930.example.com` 并点击 **继续**。
   - *注：若您的主域名 `example.com` 仍托管在 Cloudflare，Cloudflare 可能会自动在其自身 DNS 中添加一条 CNAME 记录以激活域名。由于解析权已委派给华为云，该记录并无实际作用，建议在自定义域状态变为“活动”后，前往 Cloudflare DNS 面板中将其删除。*

## 四、注入 CNAME 优选线路

当“全网默认”线路配置完成且功能正常后，即可针对中国大陆流量进行优选加速。在华为云 DNS 控制台中，为同一子域名添加第二条 CNAME 记录，操作如下：

- **主机记录**：**留空**（或填写 `@`）
- **记录类型**：`CNAME`
- **线路类型**：选择 **地域解析**，并在展开的下拉框中选中 **中国大陆**
- **记录值**：填写您选择的 Cloudflare 优选域名，例如 `cdn.rpnet.cc` 或 `cloudflare.182682.xyz`
- 点击 **确定** 保存，等待 DNS 生效。

## 最终效果

通过上述配置，您的 DoH 服务将实现智能分流：
- **境外请求**：命中“全网默认”线路，请求被指向 Cloudflare 默认边缘节点。
- **中国大陆请求**：通过华为云的地域解析调度至优选节点，显著降低解析延迟，获得稳定、快速的 DoH 体验。

本方案已在实践中验证可行，推荐中国大陆用户采用。
