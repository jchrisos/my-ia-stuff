/* {{NAME}} — settings. Persisted under a single `settings` key in chrome.storage.sync.
 *
 * Shared by the content scripts AND the popup (loaded as a plain script in both), so the
 * defaults live in exactly one place on the content side. background/settings.js holds the
 * ESM twin and tests/settings-sync.test.mjs fails if they drift. */
(function (root) {
  const {{PREFIX}} = (root.{{PREFIX}} = root.{{PREFIX}} || {});
  const KEY = 'settings';

  const DEFAULTS = {
    themeMode: 'auto', // auto | light | dark
    behaviour: {
      showButtons: true, // master switch for injected affordances
    },
  };

  function merge(base, patch) {
    const out = Object.assign({}, base);
    for (const k of Object.keys(patch || {})) {
      const v = patch[k];
      // A stored `null` for an object-typed key is corrupt storage, not "unset the group";
      // keeping it would make `behaviour.showButtons` throw at click time.
      if (v === null && base[k] && typeof base[k] === 'object') continue;
      out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] || {}, v) : v;
    }
    return out;
  }

  let cache = null;

  async function get() {
    if (cache) return cache;
    try {
      const stored = await chrome.storage.sync.get(KEY);
      cache = merge(DEFAULTS, stored[KEY] || {});
      return cache;
    } catch (e) {
      // Do NOT cache the defaults on a failed read: a transient error would otherwise pin
      // them until the next onChanged, even after storage recovers.
      return merge(DEFAULTS, {});
    }
  }

  function cached() {
    return cache || merge(DEFAULTS, {});
  }

  async function set(patch) {
    const base = await get();
    // Capture the snapshot AFTER the read: on a cold cache `cache` is null before it, and
    // reverting to null would make cached() fall back to defaults until the next read.
    const prev = cache;
    const next = merge(base, patch);
    cache = next;
    try {
      await chrome.storage.sync.set({ [KEY]: next });
    } catch (e) {
      // Revert so the cache reflects what is persisted, and let the caller surface the
      // failure (MAX_WRITE_OPERATIONS_PER_MINUTE, sync disabled, ...).
      cache = prev;
      throw e;
    }
    return next;
  }

  /** Cheap deep equality for the settings tree (plain JSON values only). */
  function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[KEY]) return;
    const next = merge(DEFAULTS, changes[KEY].newValue || {});
    // Ignore events that would not change anything (e.g. our own write echoing back).
    if (same(next, cache)) return;
    cache = next;
  });

  {{PREFIX}}.settings = { DEFAULTS, KEY, get, set, cached, merge };
})(globalThis);
