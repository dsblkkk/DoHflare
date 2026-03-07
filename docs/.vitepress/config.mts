import { defineConfig } from "vitepress";

export default defineConfig({
  title: "DoHflare",
  description:
    "地表最强 Cloudflare Workers DoH 代理，支持多级缓存、TTL 抖动及 ECS 注入。",
  cleanUrls: true,
  head: [
    [
      "meta",
      {
        name: "keywords",
        content:
          "DoHflare, Cloudflare Workers, Cloudflare Pages, DoH代理, DoH, DNS over HTTPS, 代理, 缓存, ECS注入",
      },
    ],
    ["meta", { name: "author", content: "Racpast" }],
    ["link", { rel: "canonical", href: "https://dohflare.racpast.com/" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "DoHflare" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "地表最强 Cloudflare Workers DoH 代理，支持多级缓存、TTL 抖动及 ECS 注入。",
      },
    ],
    ["meta", { property: "og:url", content: "https://dohflare.racpast.com/" }],
    [
      "meta",
      {
        property: "og:image",
        content: "https://dohflare.racpast.com/social-card.jpg",
      },
    ],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    [
      "meta",
      {
        name: "twitter:image",
        content: "https://dohflare.racpast.com/social-card.jpg",
      },
    ],
    ["meta", { name: "twitter:title", content: "DoHflare" }],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "地表最强 Cloudflare Workers DoH 代理，支持多级缓存、TTL 抖动及 ECS 注入。",
      },
    ],
    ["link", { rel: "icon", href: "https://files.rpnet.cc/favicons/icon.svg" }],
    [
      "link",
      {
        rel: "apple-touch-icon",
        href: "https://files.rpnet.cc/favicons/apple-touch-icon.png",
      },
    ],
  ],
  locales: {
    root: {
      label: "简体中文",
      lang: "zh",
      themeConfig: {
        docFooter: {
          prev: "上一页",
          next: "下一页",
        },
        lastUpdated: {
          text: "最后更新于",
        },
        notFound: {
          title: "页面未找到",
          quote:
            "但如果你不改变方向，并且继续寻找，你可能最终会到达你所前往的地方。",
          linkLabel: "前往首页",
          linkText: "带我回首页",
        },
        langMenuLabel: "多语言",
        returnToTopLabel: "回到顶部",
        sidebarMenuLabel: "菜单",
        darkModeSwitchLabel: "主题",
        lightModeSwitchTitle: "切换到浅色模式",
        darkModeSwitchTitle: "切换到深色模式",
        skipToContentLabel: "跳转到内容",
        nav: [
          { text: "主页", link: "/" },
          { text: "文档", link: "/docs/" },
          { text: "源码", link: "/source-code" },
        ],
        sidebar: {
          "/docs/": [
            {
              text: "🚀 入门指南",
              collapsed: false,
              items: [
                { text: "项目介绍", link: "/docs/" },
                { text: "部署", link: "/docs/deployment" },
                { text: "配置", link: "/docs/configuration" },
                { text: "客户端设置", link: "/docs/client-setup" },
              ],
            },
            {
              text: "🛠️ 进阶与运维",
              collapsed: false,
              items: [
                { text: "中国大陆网络优化", link: "/docs/optimization" },
                { text: "错误代码排查", link: "/docs/errors" },
                { text: "平台限制", link: "/docs/limits" },
              ],
            },
            {
              text: "ℹ️ 关于",
              items: [{ text: "许可证", link: "/docs/license" }],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: "页面导航",
        },
      },
    },
    en: {
      label: "English",
      lang: "en",
      link: "/en/",
      themeConfig: {
        nav: [
          { text: "Home", link: "/en/" },
          { text: "Docs", link: "/en/docs/" },
          { text: "Source Code", link: "/en/source-code" },
        ],
        sidebar: {
          "/en/docs/": [
            {
              text: "🚀 Getting Started",
              collapsed: false,
              items: [
                { text: "Introduction", link: "/en/docs/" },
                { text: "Deployment", link: "/en/docs/deployment" },
                { text: "Configuration", link: "/en/docs/configuration" },
                { text: "Client Setup", link: "/en/docs/client-setup" },
              ],
            },
            {
              text: "🛠️ Advanced & Ops",
              collapsed: false,
              items: [
                { text: "Error Codes", link: "/en/docs/errors" },
                { text: "Platform Limits", link: "/en/docs/limits" },
              ],
            },
            {
              text: "ℹ️ About",
              items: [{ text: "License", link: "/en/docs/license" }],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: "On this page",
        },
      },
    },
  },
  sitemap: {
    hostname: "https://dohflare.racpast.com",
  },
  themeConfig: {
    search: {
      provider: "local",
      options: {
        detailedView: true,
        miniSearch: {
          options: {
            tokenize: (str) => {
              if (!str || typeof str !== "string") return [];
              let hanClass = "\\u4E00-\\u9FFF";
              try {
                if (new RegExp("\\p{Script=Han}", "u"))
                  hanClass = "\\p{Script=Han}";
              } catch (e) {
                try {
                  if (new RegExp("\\p{Unified_Ideograph}", "u"))
                    hanClass = "\\p{Unified_Ideograph}";
                } catch (e2) {}
              }

              const hanRegex = new RegExp(`(${hanClass})`, "gu");
              const splitRegex = new RegExp(`[^\\w${hanClass}]+`, "u");
              const normalized = str
                .replace(/\r\n?/g, " ")
                .replace(/\s+/g, " ")
                .trim();

              return normalized
                .replace(hanRegex, " $1 ")
                .split(splitRegex)
                .filter(Boolean);
            },
            process: (token) => {
              try {
                return token.toLowerCase();
              } catch {
                return token;
              }
            },
          },
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: { title: 4, headings: 2, titles: 2, text: 1 },
          },
        },
        locales: {
          root: {
            translations: {
              button: {
                buttonText: "搜索文档",
                buttonAriaLabel: "搜索文档",
              },
              modal: {
                noResultsText: "无法找到相关结果",
                resetButtonTitle: "清除查询条件",
                displayDetails: "显示详细列表",
                backButtonTitle: "返回搜索结果",
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/racpast/DoHflare" },
    ],
    footer: {
      message:
        'Powered by <a href="https://pages.cloudflare.com/" target="_blank" class="reveal-link cf-link">Cloudflare Pages</a> | License: AGPL-3.0',
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://github.com/racpast" target="_blank" class="reveal-link author-link">Racpast</a>. All rights reserved.`,
    },
  },
});
