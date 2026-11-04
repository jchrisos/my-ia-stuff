// {{NAME}} — the sample feature's injection contract (content/features/sample-action.js).
//
// This is the pattern every real feature should follow, so its two invariants are pinned:
// ensure() is idempotent (the page re-renders, often reusing nodes) and the "show injected
// buttons" setting actually removes nodes without a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../content/features/sample-action.js', import.meta.url), 'utf8');

const el = (tag = 'div') => ({
  tag,
  dataset: {},
  className: '',
  innerHTML: '',
  children: [],
  attrs: {},
  parent: null,
  removed: false,
  appendChild(child) {
    child.parent = this;
    this.children.push(child);
  },
  remove() {
    this.removed = true;
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
  },
  setAttribute(k, v) {
    this.attrs[k] = v;
  },
});

function load({ showButtons = true, slots = 1, selectors } = {}) {
  let enabled = showButtons;
  const injected = [];
  const rows = [];

  for (let i = 0; i < slots; i++) {
    const slot = el('td');
    slot.querySelector = (sel) => (sel.includes('sample-action') ? slot.children[0] || null : null);
    const row = el('tr');
    row.querySelector = (sel) => (sel === 'td.slot' ? slot : null);
    rows.push({ row, slot });
  }

  const document = {
    querySelectorAll: (sel) =>
      sel.includes('sample-action') ? injected.filter((n) => !n.removed) : rows.map((r) => r.row),
    createElement: (tag) => {
      const node = el(tag);
      injected.push(node);
      return node;
    },
    addEventListener() {},
  };

  const sandbox = { document, console, requestAnimationFrame: (fn) => fn() };
  sandbox.globalThis = sandbox;
  sandbox.{{PREFIX}} = {
    SEL: selectors || { sampleRow: 'tr', sampleSlot: 'td.slot', sampleValue: 'span' },
    settings: { cached: () => ({ behaviour: { showButtons: enabled } }) },
    dom: { ownText: () => 'value' },
    toast: { show() {} },
    copyText: async () => ({ ok: true }),
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  return {
    feature: sandbox.{{PREFIX}}.features.sampleAction,
    rows,
    injected,
    setEnabled(v) {
      enabled = v;
    },
  };
}

test('ensure: injects exactly one button per slot', () => {
  const { feature, rows } = load({ slots: 3 });
  feature.ensure();
  for (const { slot } of rows) assert.equal(slot.children.length, 1);
});

test('ensure: is idempotent across repeated passes', () => {
  const { feature, rows } = load({ slots: 2 });
  feature.ensure();
  feature.ensure();
  feature.ensure();
  for (const { slot } of rows) assert.equal(slot.children.length, 1);
});

test('ensure: the setting removes and restores buttons without a reload', () => {
  const { feature, rows, setEnabled } = load();
  feature.ensure();
  assert.equal(rows[0].slot.children.length, 1);

  setEnabled(false);
  feature.ensure();
  assert.equal(rows[0].slot.children.length, 0);

  setEnabled(true);
  feature.ensure();
  assert.equal(rows[0].slot.children.length, 1);
});

test('ensure: no-ops while the selectors are unconfigured', () => {
  const { feature, rows } = load({
    slots: 2,
    selectors: { sampleRow: null, sampleSlot: null, sampleValue: null },
  });
  feature.ensure();
  for (const { slot } of rows) assert.equal(slot.children.length, 0);
});

test('the feature object exposes the id used for warn-once and a mount hook', () => {
  const { feature } = load();
  assert.equal(feature.id, 'sample-action');
  assert.equal(typeof feature.mount, 'function');
});
