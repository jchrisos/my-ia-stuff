# Manual test matrix

Run this before every release. Automated tests cover the logic; this covers the parts that
only a real page can prove (selectors, injection survival, theme states, clipboard payloads).

Target: `<site url>` — version/date verified: `<fill in>`

## Reachability

| # | Check | Pass |
|---|---|---|
| 1 | Extension loads unpacked without errors (`chrome://extensions` → Errors) | ☐ |
| 2 | Service worker starts and reports no errors | ☐ |
| 3 | On the target app, the popup reflects stored settings | ☐ |
| 4 | On an unrelated page on the same origin, no console output and no DOM changes | ☐ |
| 5 | Settings survive a browser restart (`chrome.storage.sync`) | ☐ |

## Injected UI

| # | Check | Pass |
|---|---|---|
| 1 | Buttons appear on the target rows after a fresh load | ☐ |
| 2 | Buttons survive a navigation that re-renders the list | ☐ |
| 3 | Buttons survive selecting a different row (nodes are reused) | ☐ |
| 4 | "Show injected buttons" = off removes them without a reload | ☐ |
| 5 | Re-enabling restores exactly one button per slot (no duplicates) | ☐ |
| 6 | Clicking with keyboard (Enter/Space) copies the same value as a mouse click | ☐ |

## Clipboard payloads

| # | Check | Pass |
|---|---|---|
| 1 | Copied value contains no UI text injected by us ("Copy", icon alt text) | ☐ |
| 2 | Copy updates after switching rows *without* reloading the page | ☐ |
| 3 | Empty/absent value does nothing (no empty clipboard write, no toast) | ☐ |
| 4 | Success shows one toast; a forced failure shows the error toast | ☐ |

## Theme

| # | Check | Pass |
|---|---|---|
| 1 | No flash of light on load for dark and auto-dark | ☐ |
| 2 | Light setting produces no dark class and no flash of dark | ☐ |
| 3 | Row `:hover` and row `[aria-selected]` are visually distinct (force `:hover` in DevTools) | ☐ |
| 4 | Nav/tab `:hover`, `:focus-visible`, `:active` states are all themed | ☐ |
| 5 | Form controls, placeholders, scrollbars and native selects are legible | ☐ |
| 6 | OS scheme change updates the page live while the setting is `auto` | ☐ |
| 7 | Popup changes reach an already-open tab without a reload | ☐ |

## Console / network hygiene

| # | Check | Pass |
|---|---|---|
| 1 | No uncaught errors or unhandled rejections in the page console | ☐ |
| 2 | No repeated warnings (warn-once paths behaving) | ☐ |
| 3 | No `chrome.runtime.getURL` fetches — assets are inline | ☐ |
| 4 | No WAR entries added to the manifest | ☐ |
