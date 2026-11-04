// {{NAME}} — settings merge / cache / write-failure behaviour.
//
// content/settings.js is a classic script, so it is loaded in a vm sandbox with a fake
// chrome.storage. These cases pin the failure modes that are easy to reintroduce:
// a corrupt `null` object key wiping a group, a failed read caching defaults, and a failed
// write leaving the cache showing a value that was never persisted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../content/settings.js', import.meta.url), 'utf8');

function loadSettings({ get, set } = {}) {
  const calls = { get: 0, set: 0 };
  const listeners = [];
  const chrome = {
    storage: {
      sync: {
        get: async () => {
          calls.get++;
          return get ? get() : {};
        },
        set: async (obj) => {
          calls.set++;
          if (set) return set(obj);
          return undefined;
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };
  const sandbox = { chrome, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { settings: sandbox.{{PREFIX}}.settings, calls, listeners };
}

test('merge: a null object-typed key is treated as absent', () => {
  const { settings } = loadSettings();
  const merged = settings.merge({ themeMode: 'auto', behaviour: { showButtons: true } }, { behaviour: null });
  assert.deepEqual(merged.behaviour, { showButtons: true });
});

test('merge: arrays replace rather than deep-merge', () => {
  const { settings } = loadSettings();
  assert.deepEqual(settings.merge({ list: [1, 2] }, { list: [3] }).list, [3]);
});

test('merge: unknown keys are preserved', () => {
  const { settings } = loadSettings();
  assert.equal(settings.merge({}, { extra: 1 }).extra, 1);
});

test('get: a rejected read does not cache the defaults', async () => {
  let attempt = 0;
  const { settings, calls } = loadSettings({
    get: () => {
      attempt++;
      if (attempt === 1) throw new Error('storage unavailable');
      return { settings: { themeMode: 'dark' } };
    },
  });

  assert.equal((await settings.get()).themeMode, 'auto'); // defaults, not cached
  assert.equal((await settings.get()).themeMode, 'dark'); // retried and cached
  assert.equal(calls.get, 2);
});

test('set: a rejected write reverts the cache and rethrows', async () => {
  const { settings } = loadSettings({
    set: () => {
      throw new Error('MAX_WRITE_OPERATIONS_PER_MINUTE');
    },
  });

  await settings.get(); // prime with defaults
  await assert.rejects(settings.set({ themeMode: 'dark' }), /MAX_WRITE_OPERATIONS/);
  assert.equal((await settings.get()).themeMode, 'auto'); // reverted
});

test('set: a failed write on a cold cache reverts to the loaded value, not null', async () => {
  const { settings } = loadSettings({
    get: () => ({ settings: { themeMode: 'dark' } }),
    set: () => {
      throw new Error('sync disabled');
    },
  });
  await assert.rejects(settings.set({ themeMode: 'light' }), /sync disabled/);
  assert.equal(settings.cached().themeMode, 'dark');
});

test('set: a successful write updates the cache', async () => {
  const { settings } = loadSettings();
  await settings.get();
  assert.equal((await settings.set({ themeMode: 'dark' })).themeMode, 'dark');
  assert.equal((await settings.get()).themeMode, 'dark');
});

test('onChanged: a new value refreshes the cache', async () => {
  const { settings, listeners } = loadSettings();
  await settings.get();
  assert.equal(listeners.length, 1);
  listeners[0]({ settings: { newValue: { themeMode: 'light' } } }, 'sync');
  assert.equal((await settings.get()).themeMode, 'light');
});

test('onChanged: an unrelated area is ignored', async () => {
  const { settings, listeners } = loadSettings();
  await settings.get();
  listeners[0]({ settings: { newValue: { themeMode: 'light' } } }, 'local');
  assert.equal((await settings.get()).themeMode, 'auto');
});
