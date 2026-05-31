# DeepSeek Translator

A Chrome extension that translates web pages using the DeepSeek V4 API (Flash/Pro models). Built with Manifest V3, TypeScript, and esbuild.

## Features

- **Full Page Translation** — Translates all translatable elements on the page
- **Smart Translation** — Intelligently detects and translates only foreign-language content
- **Selection Translation** — Translates selected text with a popup overlay
- **12 Target Languages** — Chinese (Simplified/Traditional), English, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Arabic, Italian
- **Batch Translation** — Groups elements into batches for efficient API usage with configurable concurrency
- **Translation Cache** — Caches translations per domain in `chrome.storage.local` to avoid duplicate API calls
- **Page Summary Enhancement** — Generates a page summary before translating to improve context and terminology accuracy
- **Thinking Mode** — Enables DeepSeek's reasoning mode for higher-quality translations
- **Auto-Translate** — Optionally auto-translates pages when the detected language differs from the target language
- **Element Picker** — Visually pick elements to exclude from translation via CSS selectors
- **Right-Click Menu** — Context menu integration for quick translation actions
- **Keyboard Shortcut** — `Alt+A` to translate page or toggle original/translated text
- **Toggle Original** — Switch between original and translated text without re-translating
- **Viewport-Only Mode** — Translates only visible elements (with scroll preloading) to save API costs
- **Site-Specific Exclusion Rules** — Define URL patterns and CSS selectors per site to skip translation

## Screenshots

> Add screenshots of the popup and options page here.

## Installation

### From Source

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Open Chrome and navigate to `chrome://extensions`
5. Enable **Developer mode** (top-right toggle)
6. Click **Load unpacked** and select the project root directory

### From ZIP

1. Download the extension ZIP package
2. Unzip it
3. Follow steps 4–6 above

## Configuration

1. Click the extension icon to open the popup, then click **Open Settings** (or right-click → Options)
2. Enter your **DeepSeek API Key** (get one at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys))
3. Choose your preferred **translation model** and **target language**
4. Adjust other settings as needed

### Settings

| Setting | Description | Default |
|---|---|---|
| API Key | DeepSeek API key | _(empty)_ |
| Model | `deepseek-v4-flash` (fast) or `deepseek-v4-pro` (high quality) | `deepseek-v4-flash` |
| Target Language | Language to translate into | `zh-CN` |
| Translation Mode | `full`, `smart`, or `selection` | `smart` |
| Custom Selectors | CSS selectors for elements to translate (smart mode) | `p, h1–h6, li, td, th, ...` |
| Max Chars Per Batch | Characters per API request | `2000` |
| Concurrency | Simultaneous API requests | `3` |
| Auto-Translate | Auto-translate foreign-language pages | `false` |
| Use Context | Send surrounding text as context | `false` |
| Show Context Menu | Add translation options to right-click menu | `true` |
| Enable Thinking | Use DeepSeek reasoning mode | `false` |
| Only Translate Visible | Translate only viewport elements | `true` |
| Page Summary | Pre-analyze page for better context | `false` |
| Global Exclude Selectors | CSS selectors to always skip | `code, pre, script, style, ...` |
| Site Exclusion Rules | Per-site URL patterns and selectors | _(empty)_ |

## Usage

### Translate Page

- Click the extension icon → **翻译整个页面** (Translate Page)
- Or press `Alt+A`
- Press `Alt+A` again to toggle between original and translated text

### Translate Selection

1. Select text on the page
2. Click the extension icon → **翻译选中文本** (Translate Selection)
3. Or right-click → Translate Selection (if context menu is enabled)

### Exclude Elements

1. Click the extension icon → **排除选择** (Pick Exclude)
2. Hover over elements to highlight them
3. Click an element to generate a CSS selector
4. Edit the selector and confirm

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Build

```bash
npm run build
```

Builds 4 IIFE bundles to `dist/` targeting Chrome 90:

| Entry | Output | Role |
|---|---|---|
| `src/background/background.ts` | `dist/background.js` | Service worker: message routing, API calls |
| `src/content/content.ts` | `dist/content.js` | Content script: DOM traversal, translation queue |
| `src/popup/popup.ts` | `dist/popup.js` | Popup action UI |
| `src/options/options.ts` | `dist/options.js` | Settings page |

### Lint

```bash
npm run lint
```

### Type Check

```bash
npx tsc --noEmit
```

### Package for Chrome Web Store

```bash
npm run package
```

## Architecture

```
src/
├── background/          # Service worker
│   ├── background.ts    # Message routing, commands, context menus
│   ├── api.ts           # DeepSeek API client, prompt builders
│   ├── menu.ts          # Context menu setup
│   └── translator.ts    # Batch/single translation orchestration
├── content/             # Content script
│   ├── content.ts       # Main logic: queue, caching, scroll handler, picker
│   ├── content.css      # UI styles (spinners, popups, picker overlay)
│   ├── extractor.ts     # DOM element extraction and translation request builder
│   ├── detector.ts      # Language detection for auto-translate
│   └── replacer.ts      # DOM replacement, toggle, spinner, toast helpers
├── popup/               # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.ts
├── options/             # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.ts
├── icons/               # Extension icons (16/48/128px)
└── lib/                 # Shared library
    ├── types.ts         # TypeScript interfaces and MessageType union
    ├── config.ts        # Config read/write via chrome.storage.sync
    └── constants.ts     # API URL, DOM attributes, language/model options
```

### Key Patterns

- **Messaging**: Chrome runtime messages between background ↔ content, with types defined in `src/lib/types.ts`. Listeners must `return true` for async responses.
- **Config**: `chrome.storage.sync` for user settings, read via `getConfig()`. Default config is `DEFAULT_CONFIG`.
- **Cache**: `chrome.storage.local` keyed by `cache_{domain}_{hash}` for per-page translation caching.
- **DOM Markers**: Elements are marked with `data-dst-original` and `data-dst-translated` attributes.
- **Batch Translation**: Content script batches elements by character count (`maxCharsPerBatch`), sends `TRANSLATE_BATCH` messages. Background calls DeepSeek API with texts joined by `\n\n` and splits the response.
- **API**: DeepSeek chat completions at `https://api.deepseek.com/chat/completions`. Supports `thinking` parameter. Retries up to 3× with exponential backoff.

## License

MIT