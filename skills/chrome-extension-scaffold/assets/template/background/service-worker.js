/* {{NAME}} — service worker (ESM).
 *
 * STATELESS on purpose: MV3 terminates the worker whenever it feels like it, so every
 * wake-up re-reads chrome.storage. Nothing is cached in a module variable that must
 * survive an event gap.
 *
 * Its only job is content-script registration for the no-FOUC theme. The persisted
 * themeMode *is* the registration state, so the class can land synchronously before
 * first paint instead of waiting for document_idle. */
import { getSettings } from './settings.js';

const SCRIPT_ID = '{{PREFIX}}-theme-apply';

/* The pre-paint scripts below are UNCONDITIONAL classList calls, so they may only be
 * registered for origins where every page is ours. Loopback patterns without an explicit
 * port (`http://localhost/*`) match EVERY local app and must be left out — those pages get
 * themed later by content/theme.js at the cost of a possible one-frame flash. */
const PREPAINT_MATCHES = {{PREPAINT_JSON}};

/* Live theme broadcasts must reach the page wherever it is served, so these use the full
 * match list (no explicit port means any port, for loopback patterns). */
const BROADCAST_MATCHES = {{MATCHES_JSON}};

const APPLY = { dark: 'theme/apply-dark.js', auto: 'theme/apply-dark-auto.js' };

async function doReconcileThemeRegistration() {
  const { themeMode = 'auto' } = await getSettings();

  // Always unregister first: registerContentScripts rejects duplicate ids, and the id
  // changes script as the mode changes.
  const existing = (await chrome.scripting.getRegisteredContentScripts()).find((s) => s.id === SCRIPT_ID);
  if (existing) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });

  const js = APPLY[themeMode];
  if (!js) return; // 'light': dark.css stays inert, nothing to register
  if (PREPAINT_MATCHES.length === 0) return; // every match is too broad to pre-paint safely

  await chrome.scripting.registerContentScripts([
    { id: SCRIPT_ID, matches: PREPAINT_MATCHES, js: [js], runAt: 'document_start', allFrames: false },
  ]);
}

/* Serialise reconciles. Rapid theme toggles fire overlapping storage events; without the
 * chain they interleave (unregister/register races) and re-register the same id, which
 * rejects with "Duplicate script ID" as an unhandled rejection. Chaining also lets callers
 * await the reconcile, which the tests rely on. */
let reconcileChain = Promise.resolve();

function reconcileThemeRegistration() {
  reconcileChain = reconcileChain.then(doReconcileThemeRegistration).catch((err) => {
    console.warn('[{{NAME}}] theme registration failed', err);
  });
  return reconcileChain;
}

async function broadcastTheme() {
  const { themeMode = 'auto' } = await getSettings();
  const tabs = await chrome.tabs.query({ url: BROADCAST_MATCHES });
  for (const t of tabs) {
    chrome.tabs.sendMessage(t.id, { type: '{{PREFIX}}:theme', mode: themeMode }).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener(reconcileThemeRegistration);
chrome.runtime.onStartup.addListener(reconcileThemeRegistration);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.settings) return;
  // Only a themeMode change affects registration/the broadcast. Other settings edits must
  // not trigger a reconcile plus a message to every open tab.
  const next = changes.settings.newValue || {};
  const prev = changes.settings.oldValue || {};
  if (next.themeMode === prev.themeMode) return;
  reconcileThemeRegistration();
  broadcastTheme();
});
