# AGENTS.md

## Project

DeepSeek Translator — a Chrome Manifest V3 extension that translates web pages using the DeepSeek V4 API (flash/pro models). All UI strings are in Chinese.

## Build & Dev

- `npm run build` — esbuild bundles 4 entry points to `dist/` as IIFE (target Chrome 90)
- `npm run watch` — runs build once (watch is not actually implemented; see `build.js`)
- `npm run lint` — eslint on `src/`
- No test framework. No `typecheck` script, but `tsconfig.json` has `"strict": true` — run `npx tsc --noEmit` to typecheck manually.
- `npm run package` — zips for Chrome Web Store (zips `manifest.json`, `dist/`, `src/popup/`, `src/options/`, `src/content/content.css`, `src/icons/`)

## Architecture

Four separate bundles built by esbuild (`build.js`):

| Entry | Output | Role |
|---|---|---|
| `src/background/background.ts` | `dist/background.js` | Service worker: message routing, context menus, keyboard commands |
| `src/content/content.ts` | `dist/content.js` | Content script: page traversal, queue, caching, scroll handling |
| `src/popup/popup.ts` | `dist/popup.js` | Popup action UI |
| `src/options/options.ts` | `dist/options.js` | Settings page |

Shared library — `src/lib/` (types, config, constants). Not bundled separately; each entry point imports what it needs.

**Non-bundled assets** loaded directly from `src/`:
- `src/popup/popup.html` + `popup.css`
- `src/options/options.html` + `options.css`
- `src/content/content.css`
- `src/icons/`

## Key patterns

- **Messaging**: Chrome runtime messages between background ↔ content, defined in `src/lib/types.ts` `MessageType`. Must `return true` in listener for async responses.
- **Config**: `chrome.storage.sync` for user settings. Read via `getConfig()` in `src/lib/config.ts`. Default config is `DEFAULT_CONFIG` export.
- **Cache**: `chrome.storage.local` keyed by `cache_{domain}_{hash}` per-page translation cache in `content.ts`.
- **DOM markers**: Elements marked with `data-dst-original` and `data-dst-translated` attributes for tracking state.
- **Batch translation**: Content script batches elements by char count (`maxCharsPerBatch`), sends `TRANSLATE_BATCH` messages to background. Background calls DeepSeek API with all texts joined by `\n\n` and splits the response back.
- **API**: DeepSeek chat completions endpoint at `https://api.deepseek.com/chat/completions`. Supports `thinking` param. Retries up to 3x with exponential backoff.

## Constraints

- IIFE format required (esbuild `format: 'iife'`) — Chrome MV3 service workers and content scripts don't support ES modules.
- `manifest.json` references `dist/` for JS, `src/` for HTML/CSS/icons. After building, load the project root as the unpacked extension in Chrome.
- `tsconfig.json` uses `"module": "ES2020"` and `"moduleResolution": "node"` which are for editor tooling only — esbuild handles actual bundling.