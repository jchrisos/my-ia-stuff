// {{NAME}} — settings drift guard.
//
// content/settings.js (classic content script) and background/settings.js (ESM service
// worker) hold duplicate DEFAULTS. The platform forces it: content scripts cannot be ESM
// and the service worker cannot be classic, so no file can be shared at runtime. This test
// is the enforcement for "keep them in sync".
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const CONTENT_SRC = readFileSync(new URL('../content/settings.js', import.meta.url), 'utf8');
const BG_SRC = readFileSync(new URL('../background/settings.js', import.meta.url), 'utf8');

function contentDefaults() {
  const sandbox = {
    console,
    chrome: {
      storage: {
        sync: { get: async () => ({}), set: async () => {} },
        onChanged: { addListener() {} },
      },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CONTENT_SRC, sandbox);
  return sandbox.{{PREFIX}}.settings.DEFAULTS;
}

async function backgroundDefaults() {
  // Copied to a .mjs file so Node treats the service-worker copy as ESM.
  const dir = mkdtempSync(join(tmpdir(), '{{PREFIX}}-settings-'));
  const file = join(dir, 'settings.mjs');
  writeFileSync(file, BG_SRC);
  const mod = await import(pathToFileURL(file).href + '?t=' + Math.random());
  rmSync(dir, { recursive: true, force: true }); // the module is in memory; do not leak the dir
  return mod.DEFAULTS;
}

test('content/ and background/ DEFAULTS are identical (no drift)', async () => {
  // JSON round-trip: the content-script DEFAULTS come from a vm realm with a different
  // Object.prototype, which deepStrictEqual would reject on prototype identity alone.
  assert.deepEqual(JSON.parse(JSON.stringify(contentDefaults())), await backgroundDefaults());
});
