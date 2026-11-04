---
name: chrome-extension-scaffold
description: Scaffolds a complete, working Chrome Manifest V3 extension project — no bundler, no npm dependencies — with a stateless service worker, a namespaced content-script bundle, a site gate, settings and popup, a no-FOUC dark theme, generated icons and node --test unit tests. Use this whenever the user wants to start, bootstrap, scaffold or restructure a Chrome or browser extension, mentions manifest.json, MV3, content scripts, service workers, "load unpacked", or wants a base project, template or skeleton for injecting UI into a web app — even if they do not say the word "extension".
---

# Chrome Extension Scaffold

Generate a working MV3 extension base instead of hand-writing the same two dozen files. The
generator is deterministic; the judgment is in the inputs and in wiring the real site
afterwards.

## 1. Collect four inputs

Ask for what is missing — do not guess the match pattern or the gate. If the user is vague
("make me an extension for our admin app"), a quick look at the page (DOM snapshot or the
user's description of a stable id/meta tag) is usually enough.

| Input | Why it matters | Example |
|---|---|---|
| `--name` | Kebab-case; becomes the directory, package name and storage identity | `acme-sidebar` |
| `--match` | The origins the extension runs on. **Never pin a port** on loopback | `https://app.acme.com/*` |
| `--gate` | A stable marker proving "this page is the app" (root id, meta tag, data attribute) | `body#app`, `meta[name="acme-version"]` |
| `--description` | Chrome Web Store limit is 132 chars | `Adds copy shortcuts to the Acme admin console.` |

Optional: `--title`, `--prefix` (JS/CSS namespace; defaults to the name's initials),
`--shape` (the stable shell that must exist before features run; defaults to the gates),
`--dir`, `--color`.

Choosing the gate well is the most important decision. It must be stable across deploys and
present on load — not a CSS-module hash, not a selector that only appears once data is
fetched. If the manifest matches a broad origin (`http://localhost/*`, `https://*.acme.com/*`),
the gate is the only thing keeping the extension off unrelated pages.

## 2. Generate

Run the generator from the parent directory the project should live in. The script lives
beside this SKILL.md; resolve `<skill-dir>` from the skill's base directory.

```bash
node <skill-dir>/scripts/scaffold.mjs \
  --name acme-sidebar \
  --title "Acme Sidebar" \
  --description "Adds copy shortcuts to the Acme admin console." \
  --match 'https://app.acme.com/*' \
  --gate 'body#app' \
  --dir ./acme-sidebar
```

`--match` and `--gate` accept repeats or comma-separated lists (OR semantics for gates).
The script refuses to overwrite a non-empty directory unless `--force` is passed, never
deletes anything, and prints the pre-paint origins it could safely register.

The output is a complete, loadable extension:

```
manifest.json            MV3: permissions, matches, content-script order
background/              stateless service worker (ESM) + settings copy
content/                 classic scripts sharing globalThis.<prefix>
  selectors.js           single source of truth + site gate
  settings.js            storage.sync + merge/cache/onChanged
  observer.js            rAF-coalesced MutationObserver, warn-once
  main.js                gate -> prime settings -> start features
  features/sample-action.js   the pattern to copy for real features
  extension.css          injected UI (not the theme)
theme/                   dark.css + two one-line pre-paint scripts
popup/                   settings UI
tests/                   node --test: manifest, settings, settings-sync,
                         selectors, observer, sample-action
icons/                   16/32/48/128 PNG, generated
Makefile                 test / check / load / package
AGENTS.md                the conventions an agent needs before editing
docs/specs/              manual test matrix to fill in
```

## 3. Verify before handing it off

Do not report success from the file list alone — run the project's own checks:

```bash
cd <dir> && make check && make test
```

Every generated test must pass as-is. If one fails, fix the template (or the generated
project) before showing the user anything; a scaffold that ships red tests teaches the
wrong lesson. `make load` prints the unpacked-load and reload steps.

## 4. Wire it to the real page

The scaffold is loadable but intentionally no-ops until the selectors are real:

1. **Fill in `content/selectors.js`.** Replace `SEL.sampleRow` / `sampleSlot` /
   `sampleValue`, record the site version + date in `SITE_VERIFIED`, and confirm the gate
   and shape selectors on the live page. Prefer ids and `data-*`; for CSS-module hashes,
   match by attribute prefix (`[class*="_panel_"]`).
2. **Replace or delete `features/sample-action.js`.** It demonstrates the whole contract:
   idempotent `ensure()` guarded by `data-<prefix>`, one delegated listener in `mount()`,
   payload read from the live DOM at click time.
3. **Register the feature in two places**: the `features` array in `content/main.js` and
   the `js` array in `manifest.json` (`selectors.js` first, `main.js` last). The generated
   manifest test fails if the order breaks; the missing-feature warning in `main.js` catches
   a file that was never added.
4. **Extend `theme/dark.css`** against the real page. Verify `:hover`, `:focus-visible`,
   `[aria-selected]` and the site's own `.selected` with the pseudo-class **forced** in
   DevTools — resting-state rules do not cover them, and eyeballing at rest will miss it.
5. **Replace the icons.** They are valid PNGs, not artwork.

Use the Chrome DevTools MCP (or the user's browser) to confirm the gate on both the target
page and an unrelated page on the same origin. If the target app is served locally, it is
usually faster to load the unpacked extension and inspect than to reason about selectors.

## 5. Report

Tell the user, briefly:

- where the project is and how to load it (`chrome://extensions` → Developer mode →
  **Load unpacked**);
- the reload matrix: content script/CSS → reload the page; service worker → extension reload
  icon, then the page; `manifest.json` → extension reload, then the page;
- what is still a TODO (selectors, sample feature, icons, theme tuning);
- that there is no build step and no `npm install`.

## What not to break

These are the decisions that make the difference between a demo and something that survives
a site redesign. `references/architecture.md` explains each one; read it before changing the
structure.

- **No bundler, no npm runtime deps, no build step.** The unpacked directory *is* the
  artifact, so the edit-reload loop is one save. Add a bundler only if the user asks; if they
  do, keep the invariants below.
- **Content scripts are classic scripts**, not modules, sharing `globalThis.<prefix>`. Only
  the service worker is ESM.
- **`selectors.js` holds every selector.** No feature may inline one.
- **The gate runs first.** On a page that fails it: no console output, no theming, no DOM
  writes.
- **`ensure()` is idempotent** and guarded by `data-<prefix>`. The page re-renders; assume
  your nodes get removed, and assume the page reuses nodes it does not replace.
- **Read data at click time**, never in a closure captured during `ensure()`.
- **The service worker is stateless.** Re-read `chrome.storage` on every wake-up; no
  in-memory state is assumed to survive.
- **Never add `web_accessible_resources`** for icons or SVGs. Inline them.
- **No remotely hosted code.** Not a CDN script, not an `eval` of fetched text.
- **Loopback match patterns carry no port.** A pattern with a port matches only that port.

## Adapting

- **Existing project, no scaffold needed**: read `references/architecture.md` and retrofit
  the invariants (gate, selector registry, idempotent ensure, stateless SW, manifest tests)
  instead of throwing the user's structure away.
- **User names a framework (wxt, Plasmo, CRXJS, Vite)**: honor it. The template is a working
  reference, not a religion; port the gate, the idempotency contract and the selector
  registry into their build. Do not silently add a bundler to a no-build request, and do not
  silently remove one they already have.
- **Firefox/Safari**: this scaffold targets Chrome MV3. Say so and ask before going further;
  the manifest and the `chrome.*` surface differ.
- **The user only wants a popup or a background script**: still scaffold, then delete the
  unused `content/` scripts and their manifest entries — but keep `make check` and the
  manifest test in sync with the deletions.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Nothing happens on the page | Gate selector does not match; check `isTargetPage()` in the console |
| Console warning "page DOM changed" | `--shape` selectors drifted; re-verify in `selectors.js` |
| Content script never runs | File missing from the manifest `js` array, or a syntax error took down the bundle |
| Buttons vanish after navigation | `ensure()` is not idempotent, or `SEL.root` is the wrong container |
| Theme flashes light then dark | Pre-paint origin excluded (loopback without port), so `document_idle` applies it |
| Popup settings do not stick | A rejected `storage.sync.set` (quota/sync disabled); the cache reverts by design |
| "Duplicate script ID" in the SW | Overlapping reconciles; the serialised chain was removed |
| Extension works locally, not in CI | Some Chrome builds ignore `--load-extension`; e2e must fall back to injecting the manifest's scripts and must print the mode |
