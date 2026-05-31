# DeepSeek Translator

[ENGLISH](./README_EN.md)

使用 DeepSeek V4 API（Flash/Pro 模型）翻译网页的 Chrome 扩展。基于 Manifest V3、TypeScript 和 esbuild 构建。

## 功能特性

- **整页翻译** — 翻译页面上所有可翻译的元素
- **智能翻译** — 智能识别并仅翻译外语文本
- **选区翻译** — 选中文字后翻译，以弹窗展示结果
- **12 种目标语言** — 简体中文、繁体中文、英语、日语、韩语、法语、德语、西班牙语、葡萄牙语、俄语、阿拉伯语、意大利语
- **批量翻译** — 将元素按字符数分组批量请求，支持配置并发数
- **翻译缓存** — 按域名缓存翻译结果到 `chrome.storage.local`，避免重复调用 API
- **页面摘要增强** — 翻译前先对页面进行分类和摘要，将结果作为上下文提供给 AI，提高翻译准确性
- **思考模式** — 启用 DeepSeek 推理模式，提升翻译质量
- **自动翻译** — 可选在检测到页面语言与目标语言不同时自动翻译
- **元素拾取器** — 可视化选取要排除的元素，自动生成 CSS 选择器
- **右键菜单** — 集成到浏览器右键菜单，快速执行翻译操作
- **键盘快捷键** — `Alt+A` 翻译页面或切换原文/译文
- **切换原文** — 在原文和译文之间切换，无需重新翻译
- **仅翻译可视区域** — 仅翻译当前屏幕可见的内容（加上上下半屏预加载），节省 API 调用成本
- **按网站排除规则** — 为特定网站设置 URL 匹配模式和 CSS 选择器排除规则

## 截图

> 在此处添加弹窗和设置页面的截图。

## 安装

### 从源码安装

1. 克隆仓库
2. 安装依赖：
   ```bash
   npm install
   ```
3. 构建扩展：
   ```bash
   npm run build
   ```
4. 打开 Chrome，访问 `chrome://extensions`
5. 开启右上角的**开发者模式**
6. 点击**加载已解压的扩展程序**，选择项目根目录

### 从 ZIP 安装

1. 下载扩展 ZIP 包并解压
2. 按上面步骤 4–6 操作

## 配置

1. 点击扩展图标打开弹窗，然后点击**打开设置**（或右键图标 → 选项）
2. 输入你的 **DeepSeek API Key**（在 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 获取）
3. 选择**翻译模型**和**目标语言**
4. 根据需要调整其他设置

### 设置项

| 设置 | 说明 | 默认值 |
|---|---|---|
| API Key | DeepSeek API 密钥 | _(空)_ |
| 翻译模型 | `deepseek-v4-flash`（快速）或 `deepseek-v4-pro`（高质量） | `deepseek-v4-flash` |
| 目标语言 | 翻译的目标语言 | `zh-CN` |
| 翻译模式 | `full`（整页）、`smart`（智能识别）或 `selection`（仅选区） | `smart` |
| 自定义选择器 | 智能模式下要翻译的 CSS 选择器 | `p, h1–h6, li, td, th, ...` |
| 每次最大字符数 | 单次 API 请求的最大字符数 | `2000` |
| 并发请求数 | 同时发送的翻译请求数量 | `3` |
| 自动翻译 | 检测到外语页面时自动翻译 | `false` |
| 携带上下文 | 翻译时携带前后元素的文本作为上下文 | `false` |
| 显示右键菜单 | 在右键菜单中添加翻译选项 | `true` |
| 启用思考模式 | 使用 DeepSeek 推理模式 | `false` |
| 仅翻译可视区域 | 只翻译当前屏幕可见的内容 | `true` |
| 页面摘要增强 | 翻译前先让 AI 对页面进行分类和摘要 | `false` |
| 全局排除选择器 | 始终跳过翻译的 CSS 选择器 | `code, pre, script, style, ...` |
| 按网站排除规则 | 按网站设置 URL 匹配模式和 CSS 选择器 | _(空)_ |

## 使用方法

### 翻译页面

- 点击扩展图标 → **翻译整个页面**
- 或按 `Alt+A`
- 再次按 `Alt+A` 可在原文和译文之间切换

### 翻译选区

1. 在页面上选中文字
2. 点击扩展图标 → **翻译选中文本**
3. 或右键 → 翻译选区（需开启右键菜单）

### 排除元素

1. 点击扩展图标 → **排除选择**
2. 将鼠标悬停在元素上进行高亮预览
3. 点击元素自动生成 CSS 选择器
4. 编辑选择器后确认

## 开发

### 前提条件

- Node.js 18+
- npm 9+

### 构建

```bash
npm run build
```

构建 4 个 IIFE 格式包到 `dist/` 目录，目标 Chrome 90：

| 入口 | 输出 | 作用 |
|---|---|---|
| `src/background/background.ts` | `dist/background.js` | Service Worker：消息路由、API 调用 |
| `src/content/content.ts` | `dist/content.js` | 内容脚本：DOM 遍历、翻译队列 |
| `src/popup/popup.ts` | `dist/popup.js` | 弹窗操作界面 |
| `src/options/options.ts` | `dist/options.js` | 设置页面 |

### 代码检查

```bash
npm run lint
```

### 类型检查

```bash
npx tsc --noEmit
```

### 打包 Chrome Web Store

```bash
npm run package
```

## 项目结构

```
src/
├── background/          # Service Worker
│   ├── background.ts    # 消息路由、快捷键、右键菜单
│   ├── api.ts           # DeepSeek API 客户端、提示词构建
│   ├── menu.ts          # 右键菜单设置
│   └── translator.ts    # 批量/单条翻译编排
├── content/             # 内容脚本
│   ├── content.ts       # 主逻辑：队列、缓存、滚动处理、选取器
│   ├── content.css      # UI 样式（加载动画、弹窗、选取器覆盖层）
│   ├── extractor.ts     # DOM 元素提取和翻译请求构建
│   ├── detector.ts      # 语言检测（自动翻译用）
│   └── replacer.ts      # DOM 替换、切换、加载动画、提示
├── popup/               # 弹窗界面
│   ├── popup.html
│   ├── popup.css
│   └── popup.ts
├── options/             # 设置页面
│   ├── options.html
│   ├── options.css
│   └── options.ts
├── icons/               # 扩展图标（16/48/128px）
└── lib/                 # 共享库
    ├── types.ts         # TypeScript 接口和消息类型
    ├── config.ts        # 通过 chrome.storage.sync 读写配置
    └── constants.ts     # API 地址、DOM 属性、语言/模型选项
```

### 核心机制

- **消息通信**：background ↔ content 通过 Chrome runtime 消息通信，类型定义在 `src/lib/types.ts`。异步响应需 `return true`。
- **配置管理**：用户设置存储在 `chrome.storage.sync`，通过 `getConfig()` 读取。默认配置为 `DEFAULT_CONFIG`。
- **翻译缓存**：按 `cache_{域名}_{哈希}` 键存储在 `chrome.storage.local`，实现页面级缓存。
- **DOM 标记**：翻译元素使用 `data-dst-original` 和 `data-dst-translated` 属性追踪状态。
- **批量翻译**：内容脚本按字符数（`maxCharsPerBatch`）分批，发送 `TRANSLATE_BATCH` 消息。后台将所有文本以 `\n\n` 连接调用 DeepSeek API，再拆分响应。
- **API 调用**：使用 DeepSeek chat completions 端点 `https://api.deepseek.com/chat/completions`，支持 `thinking` 参数，最多重试 3 次并采用指数退避。

## 许可证

MIT
