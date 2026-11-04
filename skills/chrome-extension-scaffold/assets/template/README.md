# {{TITLE}}

A Chrome Manifest V3 extension that augments a web app's UI from the outside — no bundler,
no npm runtime dependencies, no build step. Load it unpacked from this directory.

## What it does

- Injects affordances into the target app (one sample feature is wired up as a pattern).
- Adds a dark theme that applies before first paint (no flash of light).
- Stores settings in `chrome.storage.sync` and exposes them in the popup.

## Install (development)

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this directory.
3. Open the target app. The extension stays silent on pages that do not match its gate.

## Commands

| Command | What it does |
|---|---|
| `make test` | Unit tests (`node --test`, no browser, no install) |
| `make check` | Syntax-check every JS file and validate the JSON manifests |
| `make load` | Print the load / reload steps |
| `make package` | Build `dist/{{NAME}}-<version>.zip` for the Chrome Web Store |

## Layout

| Path | Purpose |
|---|---|
| `manifest.json` | MV3 entrypoint: permissions, matches, content-script order |
| `content/` | Classic content scripts sharing `globalThis.{{PREFIX}}` (selectors, settings, observer, features) |
| `background/` | Stateless MV3 service worker (ESM) + its settings copy |
| `theme/` | `dark.css` and the one-line pre-paint bootstrap scripts |
| `popup/` | Settings UI |
| `tests/` | `node --test` unit tests for the pure and DOM-facing logic |
| `docs/` | Specs and manual test matrices |

## Before you ship

- Replace `content/selectors.js` placeholders and the sample feature.
- Replace the generated icons in `icons/` with real artwork.
- Extend `theme/dark.css` against the real app; verify `:hover`, `:focus`, `[aria-selected]`
  with the pseudo-class forced in DevTools, not by eye at rest.
- Check the permission list in `manifest.json` — it should contain nothing unused.
- Read `AGENTS.md` for the conventions that keep the bundle maintainable.
