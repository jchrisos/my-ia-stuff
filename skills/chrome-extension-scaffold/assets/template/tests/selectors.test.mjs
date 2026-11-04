// {{NAME}} — site gate and shape check (content/selectors.js).
//
// selectors.js is a classic content script (an IIFE over globalThis), not a module, so it is
// loaded in a vm sandbox with a stubbed document. The gate is what lets the extension match
// a broad origin without touching pages it does not understand: if it ever returned true too
// eagerly, every other page would get the UI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../content/selectors.js', import.meta.url), 'utf8');

function loadSelectors(doc, consoleStub = console) {
  const sandbox = { document: doc, console: consoleStub };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return sandbox.{{PREFIX}};
}

// One selector present, everything else absent.
const only = (present) => (sel) => (present.includes(sel) ? {} : null);

test('isTargetPage: false on an unrelated page', () => {
  const api = loadSelectors({ querySelector: () => null });
  assert.equal(api.isTargetPage(), false);
});

test('isTargetPage: true for every gate marker on its own', () => {
  const probe = loadSelectors({ querySelector: () => null });
  assert.ok(probe.GATES.length > 0, 'a gate is required');
  for (const gate of probe.GATES) {
    const api = loadSelectors({ querySelector: only([gate]) });
    assert.equal(api.isTargetPage(), true, `gate ${gate} should match`);
  }
});

test('isTargetPage: false before <body> exists', () => {
  const api = loadSelectors({ body: null, querySelector: () => null });
  assert.equal(api.isTargetPage(), false);
});

test('assertPageShape: true when the stable shell is present, and silent', () => {
  const probe = loadSelectors({ querySelector: () => null });
  const warnings = [];
  const api = loadSelectors(
    { querySelector: (sel) => (probe.SHAPES.includes(sel) ? {} : null) },
    { warn: (...a) => warnings.push(a.join(' ')) }
  );
  assert.equal(api.assertPageShape(), true);
  assert.equal(warnings.length, 0);
});

test('assertPageShape: a missing shell warns exactly once across repeated calls', () => {
  const warnings = [];
  const api = loadSelectors({ querySelector: () => null }, { warn: (...a) => warnings.push(a.join(' ')) });
  assert.equal(api.assertPageShape(), false);
  assert.equal(api.assertPageShape(), false);
  assert.equal(warnings.length, 1);
});

test('dom.ownText: strips injected nodes and asks only for our own attribute', () => {
  const api = loadSelectors({ querySelector: () => null });
  let queried = null;
  const clone = {
    textContent: 'value',
    querySelectorAll: (sel) => {
      queried = sel;
      return [{ remove() {} }];
    },
  };
  assert.equal(api.dom.ownText({ cloneNode: () => clone }), 'value');
  assert.match(queried, /^\[data-[a-z0-9-]+\]$/);
  assert.equal(api.dom.text(null), '');
});
