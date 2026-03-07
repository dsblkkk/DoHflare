# 客户端设置与使用示例

部署后，您的 DoHflare 代理完全符合现代安全 DNS 标准。您可以配置浏览器通过您的边缘节点路由 DNS 流量，或通过 CLI 工具进行测试。

## 一、浏览器配置

现代网页浏览器原生支持 DNS over HTTPS。以下是设置私有 DoHflare 实例的方法：

* **Microsoft Edge**:
  1. 导航至 `edge://settings/privacy/security`。
  2. 向下滚动，找到并开启 **使用安全的 DNS**。
  3. 选择 **请选择服务提供商**，然后在文本框中输入您的端点 URL。
* **Google Chrome**:
  1. 导航至 `chrome://settings/security`。
  2. 打开 **使用安全 DNS**。
  3. 在 **选择 DNS 提供商** 下拉菜单中，选择 **添加自定义 DNS 服务提供商**，然后在文本框中输入您的端点 URL。

::: warning 注意
上述步骤仅供参考，因为浏览器界面可能会随更新而变化。对于其他浏览器，如 Firefox、Safari 或 Brave，请在线搜索具体的 DoH 配置指南。
:::

## 二、使用 [natesales/q](https://github.com/natesales/q)

推荐使用 `q` 测试 DoH 端点。它原生处理 DoH 封装，并产生类似 `dig` 的输出。

```bash
# 测试标准 A 记录查询
q A cloudflare.com @https://<YOUR_WORKER_DOMAIN>/dns-query
```
