# Deployment

DoHflare can be deployed to either Cloudflare **Workers** or Cloudflare **Pages**. Choose the deployment target that matches your needs and follow the steps below.

::: warning Note
The Cloudflare Dashboard user interface changes from time to time. Menu names and button locations in this guide may differ slightly from the current interface.
:::

## Prerequisites

Before deploying, prepare your repository and runtime settings.

### Environment selection

By default the project is configured for Cloudflare Workers. To deploy to Cloudflare Pages, update `wrangler.jsonc` in your repository:

1. Remove or comment out the Workers entry, for example:
```json
"main": "src/_worker.js",
```

2. Add or uncomment the Pages build output setting:

```json
"pages_build_output_dir": "src",
```

**JSON syntax note:** `wrangler.jsonc` must be valid JSON where required. Do **not** leave a trailing comma after the last item in any object or array — a trailing comma will cause a parse error and prevent builds from completing.

**Incorrect (Trailing comma):**

```json
"vars": {
  "UPSTREAM_URLS": "https://dns.google/dns-query,https://dns11.quad9.net/dns-query",
  "DOH_PATH": "/dns-query", // <-- Causes ParseError
}
```

**Correct:**

```json
"vars": {
  "UPSTREAM_URLS": "https://dns.google/dns-query,https://dns11.quad9.net/dns-query",
  "DOH_PATH": "/dns-query"
}
```

### Environment variables and secrets

DoHflare accepts runtime configuration through one of two methods. For a complete list of available variables, default values, and their behaviors, refer to the [Configuration](/en/docs/configuration.md) guide:

* **In `wrangler.jsonc`** — define non-sensitive values in the `vars` block. This is convenient for version-controlled configuration and automated deployments.
* **In the Cloudflare Dashboard** — add sensitive values (for example, `DOH_PATH`) as encrypted secrets via the project **Variables and Secrets** settings. Use the Dashboard for values that must remain encrypted or when deploying via direct upload.

Note: when using CLI or Git-based deployments, plaintext variables in `wrangler.jsonc` are applied to the project. Encrypted secrets must be created in the Dashboard.

## Option A: Deploying to Cloudflare Workers

### Method 1 — GitHub integration (recommended)

This automates deployments and keeps deployment history in version control.

1. Fork the repository to your GitHub account.
2. In the Cloudflare Dashboard, navigate to **Workers & Pages** → **Create application**.
3. Under the **Ship something new** section, select **Continue with GitHub**.
4. Connect and authorize GitHub, then select your forked repository.
5. On the setup page, give the project a name using only lowercase letters, numbers, and dashes (for example, `dohflare`), then click **Deploy**.
6. After deployment, configure custom domains under **Settings → Domains & Routes**.

### Method 2 — Cloudflare Dashboard (manual)

Use the web editor to deploy quickly.

1. In the Cloudflare Dashboard, navigate to **Workers & Pages** → **Create application**.
2. Under the **Ship something new** section, select **Start with Hello World!**, give the Worker a lowercase name, and click **Deploy**.
3. Replace the template script by opening **Edit code** and pasting the raw contents of `src/_worker.js`.
4. Configure environment variables in the Dashboard as described above.
5. Configure custom domains under **Settings → Domains & Routes**.

### Method 3 — Wrangler CLI

Use the Cloudflare CLI to deploy from your terminal.

1. Log in locally:

```bash
npx wrangler login
```

2. Deploy using your `wrangler.jsonc`:

```bash
npx wrangler deploy
```

## Option B: Deploying to Cloudflare Pages

### Method 1 — GitHub integration (recommended)

This enables automatic deployments on push.

1. Make sure `wrangler.jsonc` is configured for Pages (see **Prerequisites**).
2. In the Cloudflare Dashboard, navigate to **Workers & Pages** → **Create application**.
3. Click **Get started** next to "Looking to deploy Pages?" at the bottom of the page.
4. Under the **Import an existing Git repository** section, click **Get started**.
5. Connect your GitHub account, select your forked repository, and click **Begin setup**.
6. Keep the default build settings; Pages will automatically use `pages_build_output_dir` from `wrangler.jsonc`.
7. Click **Save and Deploy**, then configure custom domains under the **Custom domains** tab.

### Method 2 — Cloudflare Dashboard (direct upload)

Upload static files directly without Git.

1. [Download](https://github.com/racpast/DoHflare/archive/refs/heads/main.zip) and extract the repository source ZIP.
2. In the Cloudflare Dashboard, navigate to **Workers & Pages** → **Create application**.
3. Click **Get started** next to "Looking to deploy Pages?" at the bottom of the page.
4. Under the **Drag and drop your files** section, click **Get started**.
5. On the "Deploy a site by uploading your project" screen, name the project using only lowercase letters, and click **Create project**.
6. Choose to upload a **folder** and directly select the extracted `src` directory (which contains `_worker.js`), then click **Deploy site**.
7. Configuration note: direct upload does not use `wrangler.jsonc`. Manually add any required environment variables or secrets in the Dashboard.

### Method 3 — Wrangler CLI

Deploy Pages from the terminal:

```bash
npx wrangler pages deploy --branch main
```

If the project does not exist, Wrangler will prompt you to create it — follow the prompts to proceed.
