# Architecture and invariants

Why the scaffold looks the way it does. Read this before changing the structure, and when
retrofitting these ideas into an existing extension.

## Contents

1. [Why no build step](#1-why-no-build-step)
2. [The isolated world](#2-the-isolated-world)
3. [The site gate](#3-the-site-gate)
4. [Selector registry](#4-selector-registry)
5. [Injection survival](#5-injection-survival)
6. [Settings](#6-settings)
7. [The service worker](#7-the-service-worker)
8. [The no-FOUC theme](#8-the-no-fouc-theme)
9. [Security and exposure](#9-security-and-exposure)
10. [Testing](#10-testing)
11. [Packaging and the Chrome Web Store](#11-packaging-and-the-chrome-web-store)
12. [Anti-patterns](#12-anti-patterns)

---

## 1. Why no build step

The unpacked directory **is** the artifact. That buys a one-save edit-reload loop, a
manifest you can read, and zero supply-chain surface for runtime code. It costs you module
imports in content scripts and any JSX/TypeScript.

MV3 forbids remotely hosted code, so a bundler is not required for compliance — but a build
step is still an extra failure mode. Keep the no-build layout unless the user has a concrete
reason (component framework, type system, shared package). If they do, port the invariants
below rather than the file layout.

## 2. The isolated world

Content scripts share the DOM with the page but not its JS objects. Consequences:

- You cannot read the site's framework state (React props, Vue instances, stores). Treat the
  DOM as the API.
- `globalThis.<prefix>` is yours alone; it is not visible to the page. That is why the
  bundle can share state across files without leaking.
- Content scripts cannot `import`. They are **classic scripts** loaded in manifest order
  into one world. Two files cannot share code through an ES module graph.
- The service worker **is** an ES module (`"type": "module"`). It has no DOM.

The classic/ESM split is why settings exist twice (`content/settings.js` and
`background/settings.js`). A build could share one file; without a build, the only honest
option is duplication plus a test that fails on drift (`tests/settings-sync.test.mjs`).

If a pure-logic content script also needs to be unit-testable, wrap it so it works both ways:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; // node --test
  else (root.<prefix> = root.<prefix> || {}).thing = api;                 // content script
})(globalThis, function () { /* ... */ return { /* ... */ }; });
```

## 3. The site gate

Matching is origin-level; understanding is page-level. They are different questions, and
conflating them is how extensions end up decorating login screens and error pages.

- **Matches** (`manifest.json`) should be as broad as the deployment really is. `https://*.acme.com/*`
  is normal. Loopback patterns are the classic case: the app may be served on any port, so
  `http://localhost/*` is correct — and it also matches every unrelated local app.
- **The gate** (`selectors.js`) answers "is this the app?" with stable markers: a root id, a
  meta tag the app always emits, a `data-app` attribute. The check must be synchronous,
  cheap, and silent — it runs on every page before anything else.
- **The shape check** is the softer gate that features use. It must only require the stable
  shell. Requiring a detail panel or a selected row is wrong: "nothing selected" is a normal
  state, and warning on it trains everyone to ignore the warning.

When the gate fails, do nothing at all: no console output, no classes, no observers. Any
output on a page you do not own is a bug report waiting to happen.

## 4. Selector registry

Every selector lives in `content/selectors.js`. That single rule pays for itself the first
time the site ships a redesign: the diff is one file.

Practical guidance:

- Prefer `id` and `data-*` attributes; they are explicit contracts.
- Many sites ship CSS-module hashes (`_panel_ab12cd`). Match the stable prefix:
  `[class*="_panel_"]`. A bare `._panel_ab12cd` breaks on every deploy.
- Do not write selectors that encode state you do not control (`.selected`, `:nth-child(3)`,
  text content). If you must key off text, keep it in one helper so it can be updated once.
- Record which site version/date you verified against. When the shape warning fires, that
  note is the first question.

## 5. Injection survival

The page owns the DOM. It will remove your nodes on its next render, and it will reuse nodes
without replacing them.

- One rAF-coalesced `MutationObserver` re-runs every feature's `ensure()`. Coalescing matters:
  a busy app mutates many times per frame, and `ensure()` on every record is wasted work.
- `ensure()` must be **idempotent**: find the host, inject only if absent, and refresh
  attributes/state on every pass. "It exists" is not "it is correct" when the page reuses
  `<tr>`/`<td>` nodes across selection changes.
- Guard injected nodes with `data-<prefix>` so you can find them, strip them from copied text,
  and remove them when a setting disables the feature.
- A feature that throws should warn **once per id**, not once per frame. The observer keeps a
  warned set.
- Watch for the observed root being replaced. A replaced container produces no mutation on the
  old root, so a `childList` watcher on `<body>` re-observes when the followed root disconnects.
- Register listeners once, in `mount()`, delegated from `document`. Never one listener per
  injected node: the page re-renders and you leak handlers.
- Read the payload from the **live DOM at click time**. A closure captured during `ensure()`
  goes stale as soon as the node is reused.

## 6. Settings

- One `settings` key in `chrome.storage.sync`, deep-merged over `DEFAULTS`.
- A stored `null` for an object-typed key is corrupt storage, not "unset the group". Ignore it;
  otherwise `settings.behaviour.showButtons` throws at click time.
- Arrays replace, objects merge.
- A failed read must **not** cache the defaults: a transient error would otherwise pin them
  until the next `onChanged`.
- A failed write must revert the cache and rethrow, so the UI re-renders from what is actually
  persisted (quota, sync disabled, enterprise policy).
- Listen to `chrome.storage.onChanged` for both the page and the popup. Do not rely solely on
  the service worker's broadcast: the content world can hear storage directly, so an open tab
  still updates if the worker is asleep or its context went stale.

## 7. The service worker

MV3 workers are event-driven and may be terminated between any two events. Therefore:

- **No long-lived in-memory state.** Every handler re-reads `chrome.storage`.
- **Serialise async work that races.** Theme toggles fire overlapping `onChanged` events; an
  unserialised unregister/register pair interleaves and throws "Duplicate script ID" as an
  unhandled rejection. Chain the work on a promise and let callers await it.
- **Filter events early.** A settings change that did not touch `themeMode` must not trigger a
  registration reconcile or a message to every open tab.
- `onInstalled` **and** `onStartup` both need to reconcile: registration is not guaranteed to
  survive a browser restart.

## 8. The no-FOUC theme

A dark theme applied at `document_idle` flashes light. There is no CSS-only fix that knows
about a stored preference. The pattern:

1. The persisted `themeMode` **is** the registration state.
2. The service worker registers a one-line script (`theme/apply-dark.js` or
   `apply-dark-auto.js`) at `document_start` for the appropriate origins.
3. That script does an unconditional `classList.add('<prefix>-dark')` — synchronous, no awaits.
4. `dark.css` is always injected but every rule is scoped under `html.<prefix>-dark`, so the
   live toggle is a class flip with no re-injection.

Two traps:

- An unconditional pre-paint script is dangerous on broad match patterns. Register it only for
  origins where every page is yours. Loopback patterns without a port match every local app, so
  those pages are themed at `document_idle` instead (possible one-frame flash, correct content).
- If the page turns out not to be the app, remove the class in `main.js`. The pre-paint script
  cannot know.

CSS cascade rules:

- Scope under `html.<prefix>-dark`. Use specificity, never `!important`.
- Never wrap the theme in `@layer`: unlayered page CSS beats layered CSS, so the theme silently
  stops applying.
- Resting-state rules do not cover `:hover`, `:focus-visible`, `:active`, `[aria-selected]` or
  the site's own `.selected`. Bootstrap's `.nav > li > a:hover` and framework selection styles
  are more specific than plain element rules. Write those rules explicitly and verify with the
  pseudo-class **forced** (DevTools → `:hov` → `:hover`), not by eye at rest.
- Keep hover and selected visually distinct — different tokens, not two shades of the same one.
- Raise specificity by doubling the class (`html.x-dark.x-dark`) before reaching for
  `!important`.

## 9. Security and exposure

- **No `web_accessible_resources`.** It exposes files to the page and to other extensions and
  is almost never needed: inline SVG in JS, use `data:` URIs, and let the manifest declare CSS.
- **No remotely hosted code.** No CDN `<script>`, no `eval` of fetched text, no `new Function`.
  This is an MV3 platform rule, not just a preference.
- Treat page content as hostile. If the extension copies page text into a shell command, quote
  every argument (`sh()` single-quoting for POSIX), including the HTTP method — valid tokens
  include `` ` ``, `$`, `|`, `&` and `'`. Never interpolate page text unquoted.
- Clipboard writes on an `https` page need no permission: `navigator.clipboard.writeText()`
  from the content script, with the user's click supplying transient activation. There is no
  `clipboardWrite` MV3 permission.
- Keep the permission list minimal. `scripting` is only needed by the dynamic theme
  registration; `storage` only because settings are stored.

## 10. Testing

No framework, no install: `node --test` plus `node:vm` is enough to cover the parts that break
silently.

| Test | What it pins |
|---|---|
| `manifest.test.mjs` | No pinned port on loopback, referenced files exist, permissions exact, no WAR, content-script order, version parity |
| `settings.test.mjs` | Null-key corruption, array replacement, failed read not cached, failed write reverted, `onChanged` |
| `settings-sync.test.mjs` | The classic and ESM `DEFAULTS` are identical |
| `selectors.test.mjs` | The gate is false on unrelated pages and true for every marker; shape warns once |
| `sample-action.test.mjs` | ensure() injects once per slot, is idempotent, and honours the settings switch |
| `observer.test.mjs` | rAF coalescing, warn-once, detached-root re-observation |

The `vm` pattern: read the classic script, build a sandbox with `document`/`chrome`/`console`
stubs, `vm.createContext(sandbox)`, `vm.runInContext(SRC, sandbox)`, then assert on
`sandbox.<prefix>`. Set `sandbox.globalThis = sandbox` first.

Anything that needs a real layout or CSS cascade belongs in the manual matrix
(`docs/specs/manual-test-matrix.md`), not in a fake DOM.

## 11. Packaging and the Chrome Web Store

- `make package` zips only what ships: `manifest.json`, `background/`, `content/`, `theme/`,
  `popup/`, `icons/`. Tests, docs, the Makefile and packaging metadata stay out.
- `description` ≤ 132 chars. Icons: 16/32/48/128. `minimum_chrome_version` set deliberately.
- Privacy: a content script that reads the page must say so in the listing. If nothing leaves
  the machine, say that explicitly.
- Store review rejects remotely hosted code and over-broad permissions; both are tested here.

## 12. Anti-patterns

| Anti-pattern | Why it bites |
|---|---|
| Selector literals inside features | A redesign becomes a treasure hunt; drift is silent |
| `setTimeout(ensure, 1000)` instead of an observer | Misses fast renders, burns CPU on idle pages |
| Non-idempotent `ensure()` | Duplicate buttons after every re-render |
| Capturing values in a click closure | Copies the previous row's data after a selection change |
| `!important` throughout the theme | Unfixable specificity war with the host page |
| `@layer` around the theme | Unlayered page CSS always wins; theme looks ignored |
| Assuming the SW stays alive | Lost state, duplicate listeners, missed reconciles |
| `web_accessible_resources` for icons | Exposes internals to the page for no benefit |
| One listener per injected node | Handler leak on every re-render |
| Broad match with no gate | The extension visibly runs on unrelated pages |
| Pinning `:4040` in a match pattern | Works locally, silently dead anywhere else |
