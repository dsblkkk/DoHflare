# 部署

DoHflare 可部署至 Cloudflare **Workers** 或 Cloudflare **Pages**。请根据自身需求选择目标平台，并按照对应的步骤操作。

::: warning 注意
Cloudflare 控制面板的用户界面会不定期变动。本指南中提到的菜单名称和具体按钮位置仅供参考，实际操作时可能略有不同。
:::

## 准备工作

在开始部署前，请先准备好代码仓库并进行必要的运行环境设置。

### 选择部署环境

该项目默认配置为部署到 Cloudflare Workers。如需部署到 Cloudflare Pages，请修改仓库中的 `wrangler.jsonc` 文件：

1. 移除或注释掉 Workers 的入口配置，例如：
```json
"main": "src/_worker.js",
```

2. 添加或取消注释 Pages 构建输出目录的设置：

```json
"pages_build_output_dir": "src",
```

**关于 JSON 语法的说明：** `wrangler.jsonc` 在必要的位置必须符合 JSON 格式规范。请务必不要在对象或数组的最后一个元素后添加尾随逗号——尾随逗号会导致解析错误，使构建过程无法完成。

**错误示例（包含尾随逗号）：**

```json
"vars": {
  "UPSTREAM_URLS": "https://dns.google/dns-query,https://dns11.quad9.net/dns-query",
  "DOH_PATH": "/dns-query", // <-- 此处的尾随逗号会导致解析错误
}
```

**正确示例：**

```json
"vars": {
  "UPSTREAM_URLS": "https://dns.google/dns-query,https://dns11.quad9.net/dns-query",
  "DOH_PATH": "/dns-query"
}
```

### 环境变量与机密信息设置

DoHflare 支持通过以下两种方式配置运行时参数。所有可用的变量、默认值及其详细行为，请参阅[配置](/docs/configuration.md)：

* **在 `wrangler.jsonc` 中配置**——将非敏感信息定义在 `vars` 代码块中。这种方式便于进行版本控制和自动化部署。
* **在 Cloudflare 控制面板中配置**——将敏感信息（例如 `DOH_PATH`）作为加密的机密信息添加到项目的 **变量和机密** 设置中。对于需要加密存储的值，或者通过直接上传方式部署时，建议使用控制面板进行配置。

请注意：当使用命令行界面或基于 Git 的部署方式时，`wrangler.jsonc` 中的明文变量会被应用到项目中。而加密的机密信息则必须在控制面板中单独创建。

## 方案 A：部署到 Cloudflare Workers

### 方法 1 —— 通过 GitHub 集成（推荐）

这种方式可以实现自动化部署，并将部署历史保存在版本控制系统中。

1. 将代码仓库复刻（Fork）到您自己的 GitHub 账户。
2. 登录 Cloudflare 控制面板，进入 **Workers 和 Pages** → **创建应用程序**。
3. 在 **Ship something new** 区域，选择 **Continue with GitHub**。
4. 按照提示连接并授权 GitHub，然后选择您复刻的仓库。
5. 在配置页面，为项目指定一个只包含小写字母、数字和连字符的名称（例如 `dohflare`），然后点击 **部署**。
6. 部署完成后，可以在 **设置 → 域和路由** 中配置自定义域名。

### 方法 2 —— 通过 Cloudflare 控制面板（手动）

使用网页编辑器进行快速部署。

1. 在 Cloudflare 控制面板中，进入 **Workers 和 Pages** → **创建应用程序**。
2. 在 **Ship something new** 区域，选择 **从 Hello World! 开始**，为 Worker 指定一个小写名称，然后点击 **部署**。
3. 点击 **编辑代码** 替换模板脚本，将 `src/_worker.js` 文件的原始内容粘贴到编辑器中。
4. 按照前文所述，在控制面板中配置环境变量。
5. 在 **设置 → 域和路由** 中配置自定义域名。

### 方法 3 —— 使用 Wrangler 命令行工具

通过 Cloudflare 的命令行工具在终端进行部署。

1. 在本地登录：

```bash
npx wrangler login
```

2. 使用您的 `wrangler.jsonc` 配置文件进行部署：

```bash
npx wrangler deploy
```

## 方案 B：部署到 Cloudflare Pages

### 方法 1 —— 通过 GitHub 集成（推荐）

这种方式可以在代码推送时自动触发部署。

1. 确保已根据 **准备工作** 中的说明将 `wrangler.jsonc` 配置为 Pages 环境。
2. 在 Cloudflare 控制面板中，进入 **Workers 和 Pages** → **创建应用程序**。
3. 点击页面底部的 **想要部署 Pages？** 旁边的 **开始使用**。
4. 在 **导入现有 Git 存储库** 区域，点击 **开始使用**。
5. 连接您的 GitHub 账户，选择您复刻的仓库，然后点击 **开始设置**。
6. 保持默认的构建设置不变；Pages 将自动使用 `wrangler.jsonc` 中配置的 `pages_build_output_dir`。
7. 点击 **保存并部署**，之后可以在 **自定义域** 标签页配置自定义域名。

### 方法 2 —— 通过 Cloudflare 控制面板（直接上传）

无需使用 Git，直接上传静态文件。

1. [下载](/DoHflare-main.zip) 并解压项目源代码的 ZIP 压缩包。
2. 在 Cloudflare 控制面板中，进入 **Workers 和 Pages** → **创建应用程序**。
3. 点击页面底部的 **想要部署 Pages？** 旁边的 **开始使用**。
4. 在 **拖放文件** 区域，点击 **开始使用**。
5. 在 **通过上传项目部署站点** 页面，为项目指定一个只包含小写字母的名称，然后点击 **创建项目**。
6. 选择上传 **文件夹**，直接选中解压后的 `src` 目录（该目录下应包含 `_worker.js` 文件），然后点击 **部署站点**。
7. 配置说明：直接上传方式不会使用 `wrangler.jsonc` 文件。如有需要，请在控制面板中手动添加任何必需的环境变量或机密信息。

### 方法 3 —— 使用 Wrangler 命令行工具

通过终端部署到 Pages：

```bash
npx wrangler pages deploy --branch main
```

如果项目尚不存在，Wrangler 会提示您创建它——请按照提示操作即可。
