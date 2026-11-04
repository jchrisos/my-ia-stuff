# {{TITLE}}

## What this is

A Chrome **Manifest V3** extension that augments an existing web app from the outside. It
scrapes and decorates the page DOM; it does not own the app's data layer. Plain ES2022 files
loaded unpacked from this directory — **no bundler, no npm runtime dependencies, no build
step**.

## Commands

- `make test` / `npm test` — unit tests (`node --test 'tests/*.test.mjs'`).
- `make check` — `node --check` every JS file and validate the JSON manifests.
- `make load` — print the load-unpacked / reload steps.
- `make package` — build `dist/<name>-<version>.zip` for the Chrome Web Store.
- There is **no build step**. Reload rules after an edit:
  - content script / CSS → reload the target page (`Cmd+R`).
  - `background/service-worker.js` → click the extension's **reload** icon, then reload the page
    (the service worker is not hot-reloaded).
  - `manifest.json` → reload the extension, then the page.

## Architecture

- `manifest.json` — MV3. Matches the target app's origin; permissions are `storage` +
  `scripting`. **No `web_accessible_resources`** — icons are inline SVG / `data:` URIs. Adding
  WAR exposes files to the page and is almost never needed.
- `background/service-worker.js` (ESM) — **stateless**. It owns the *dynamic content-script
  registration* that removes the dark-mode FOUC, plus the live-theme broadcast. MV3 can
  terminate it at any moment, so every wake-up re-reads `chrome.storage`.
  - The pre-paint script is an unconditional `classList.add`, so it is registered only for
    origins where every page is ours. Loopback patterns without a port match every local app
    and are deliberately excluded; those pages are themed at `document_idle` instead.
- `content/` — classic scripts in `manifest.json` order, sharing one isolated world via
  `globalThis.{{PREFIX}}`. **Not ES modules**: they cannot `import`. If a file must also be
  unit-testable, it can `module.exports` under a UMD wrapper.
  - `selectors.js` is the **single source of truth** for every DOM selector. Add selectors
    there, never inline. Prefer stable ids/data attributes; for CSS-module hashes match by
    attribute prefix (`[class*="_panel_"]`).
  - The manifest may match pages the app serves for other purposes, so
    `{{PREFIX}}.isTargetPage()` is the gate in `main.js`. On any other page the bundle bails
    silently (no console output, no theming, no DOM writes).
  - `observer.js` re-asserts injected UI on an rAF-coalesced `MutationObserver`; every
    feature's `ensure()` **must be idempotent** (guarded by `data-{{PREFIX}}`). A feature that
    throws warns once per id. A detached observed root is re-observed (a `childList` watcher
    on `<body>` notices the container being replaced, which produces no mutation on the old root).
  - Copy handlers read the **live DOM at click time** — never capture payloads in a closure.
    The app's framework reuses nodes across selection changes, so the node identity is not the
    data identity.
- `theme/dark.css` is the only stylesheet we author for the page. It is always injected but
  inert without `html.{{PREFIX}}-dark`. Scope every rule under that class (specificity, not
  `!important`); **never use `@layer`** (unlayered page CSS would win).
  - **Hover/focus/selected states need explicit rules.** Resting-state rules do not cover
    `:hover`, `:focus-visible`, `[aria-selected]` or the app's own `.selected` class. A
    resting-state scan will miss them — verify with the pseudo-class **forced** in DevTools.
  - Keep hover (`--{{PREFIX}}-surface-2`) and selected (`--{{PREFIX}}-selected`) visually distinct.
- `popup/` reuses `content/settings.js` so the defaults live in one place on the content side.
  `background/settings.js` holds the ESM twin; `tests/settings-sync.test.mjs` enforces parity.

## Local testing

Load the extension unpacked (`chrome://extensions` → **Load unpacked** → this directory), then
open the target app. There is no fixture server in this project: add one under `tools/` if you
need controlled responses, and keep it out of the packaged zip.

Some Chrome builds **ignore `--load-extension`**, which means an automated e2e run cannot rely
on the extension being installed. If you add one, have it fall back to injecting the
manifest's content scripts with `Page.addScriptToEvaluateOnNewDocument`, and print which mode
it used — never read a green run as "the extension loaded".

## Conventions

- Settings live under one `settings` key in `chrome.storage.sync`, deep-merged with `DEFAULTS`.
  A stored `null` for an object-typed key is treated as corrupt, not as "unset the group".
- `set()` reverts its cache when the write rejects (quota, sync disabled), so the UI never
  shows a value that was not persisted.
- Clipboard writes need **no permission** on a secure context; `navigator.clipboard.writeText()`
  from the content script is correct. There is no `clipboardWrite` MV3 permission.
- Match patterns: a pattern with an explicit port matches **only** that port. Loopback patterns
  (`http://localhost/*`) are the usual way an extension silently stops working when the app
  moves to another port.
- Docs go in `docs/`: plans and review reports in `docs/plans/<topic>-<YYYY-MM-DD>.md`, specs in
  `docs/specs/`. Never write them into tool/agent directories.
