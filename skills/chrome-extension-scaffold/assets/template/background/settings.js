/* {{NAME}} — settings, ESM copy for the service worker.
 *
 * DUPLICATE of the DEFAULTS in content/settings.js. That duplication is forced by the
 * platform: content scripts are classic scripts and cannot import ESM, and the service
 * worker is ESM. tests/settings-sync.test.mjs fails the build if the two drift, so keep
 * them identical. */
const KEY = 'settings';

export const DEFAULTS = {
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

export async function getSettings() {
  try {
    const stored = await chrome.storage.sync.get(KEY);
    return merge(DEFAULTS, stored[KEY] || {});
  } catch (e) {
    // Do NOT cache the defaults on a failed read: a transient error must not pin them.
    return merge(DEFAULTS, {});
  }
}
