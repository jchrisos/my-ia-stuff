/* {{NAME}} — live theme class toggle.
 *
 * The class is normally applied synchronously at document_start by a dynamically
 * registered 1-line script (background/service-worker.js). This module handles *live*
 * changes: the popup broadcasts a new mode, and the OS may switch scheme. */
(function (root) {
  const {{PREFIX}} = (root.{{PREFIX}} = root.{{PREFIX}} || {});
  const DARK_CLASS = '{{PREFIX}}-dark';

  function apply(mode) {
    const on = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle(DARK_CLASS, on);
  }

  function init() {
    // Idempotent: also covers the cases where the pre-paint script was skipped (a match
    // pattern too broad to pre-paint safely, or a stale extension load).
    apply({{PREFIX}}.settings.cached().themeMode);

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === '{{PREFIX}}:theme') apply(msg.mode);
    });

    // Do not depend on the service worker's broadcast: the content world can hear storage
    // changes directly, so open tabs still update if the SW fails or its context goes stale.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes.settings) return;
      const mode = changes.settings.newValue && changes.settings.newValue.themeMode;
      if (mode) apply(mode);
    });

    // Keep `auto` honest when the OS scheme changes without a reload.
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if ({{PREFIX}}.settings.cached().themeMode !== 'auto') return;
      document.documentElement.classList.toggle(DARK_CLASS, e.matches);
    });
  }

  {{PREFIX}}.theme = { apply, init, DARK_CLASS };
})(globalThis);
