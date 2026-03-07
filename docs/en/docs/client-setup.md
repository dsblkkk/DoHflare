# Client Setup & Usage Examples

Once deployed, your DoHflare proxy is fully compliant with modern Secure DNS standards. You can configure your browsers to route DNS traffic through your edge node or test it via CLI tools.

## 1. Browser Configuration

Modern browsers natively support DNS over HTTPS. Here is how you can set up your private DoHflare instance:

* **Microsoft Edge**:
  1. Navigate to `edge://settings/privacy/security`.
  2. Scroll down to find and turn on **Use secure DNS**.
  3. Select **Choose a service provider**, and enter your Endpoint URL in the text box.
* **Google Chrome**:
  1. Navigate to `chrome://settings/security`.
  2. Turn on **Use secure DNS**.
  3. In the **Select DNS provider** dropdown, choose **Add custom DNS service provider**, and enter your Endpoint URL in the text box.

::: warning Note
The steps above are for reference only, as browser interfaces may change with updates. For other browsers like Firefox, Safari, or Brave, please search online for specific DoH configuration guides.
:::

## 2. Using [natesales/q](https://github.com/natesales/q)

`q` is recommended for testing DoH endpoints. It handles DoH encapsulation natively and produces `dig`-like output.

```bash
# Test a standard A record query
q A cloudflare.com @https://<YOUR_WORKER_DOMAIN>/dns-query
```
