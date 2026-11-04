// {{NAME}} — observer coalescing, warn-once and detached-root recovery.
//
// content/observer.js is a classic script over globalThis, so it is loaded in a vm sandbox
// with a fake requestAnimationFrame / MutationObserver and a stubbed document.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../content/observer.js', import.meta.url), 'utf8');

function loadObserver({ features = [], root } = {}) {
  const rafQueue = [];
  const observers = [];
  const warnings = [];
  const container = { isConnected: true }; // stands in for document.body
  let currentRoot = root || { isConnected: true };

  class FakeMutationObserver {
    constructor(cb) {
      this.cb = cb;
      this.disconnected = false;
      this.observed = [];
      observers.push(this);
    }
    observe(node, opts) {
      this.observed.push({ node, opts });
    }
    disconnect() {
      this.disconnected = true;
    }
  }

  const document = {
    body: container,
    querySelector: (sel) => (sel === '#app' ? currentRoot : null),
  };

  const sandbox = {
    document,
    console: { warn: (...args) => warnings.push(args.join(' ')) },
    MutationObserver: FakeMutationObserver,
    requestAnimationFrame: (fn) => rafQueue.push(fn),
  };
  sandbox.globalThis = sandbox;
  sandbox.{{PREFIX}} = { SEL: { root: '#app' }, assertPageShape: () => true };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  return {
    observer: sandbox.{{PREFIX}}.observer,
    rafQueue,
    observers,
    warnings,
    // The content observer follows #app; the root watcher follows document.body.
    contentObservers: () => observers.filter((o) => o.observed.some((x) => x.node !== container)),
    fireBodyWatcher() {
      const w = observers.find((o) => o.observed.some((x) => x.node === container));
      if (w) w.cb();
    },
    setRoot(next) {
      currentRoot = next;
    },
    flush() {
      const queue = rafQueue.splice(0);
      for (const fn of queue) fn();
    },
  };
}

test('coalesces multiple mutations into one ensure() per frame', () => {
  let calls = 0;
  const feature = { id: 'f', ensure: () => calls++ };
  const h = loadObserver({ features: [feature] });
  h.observer.start([feature]);
  calls = 0;

  const notify = h.observers[0].cb;
  notify();
  notify();
  notify();
  assert.equal(h.rafQueue.length, 1); // one rAF for three mutations
  h.flush();
  assert.equal(calls, 1);
});

test('a feature that throws warns only once', () => {
  const feature = {
    id: 'boom',
    ensure() {
      throw new Error('nope');
    },
  };
  const h = loadObserver({ features: [feature] });
  h.observer.start([feature]); // ensureAll runs immediately -> first warning
  h.observers[0].cb();
  h.flush();
  h.observers[0].cb();
  h.flush();
  assert.equal(h.warnings.length, 1);
});

test('a detached observed root is re-observed via the body watcher', () => {
  const feature = { id: 'f', ensure() {} };
  const h = loadObserver({ features: [feature] });
  h.observer.start([feature]);
  assert.equal(h.contentObservers().length, 1);
  const first = h.contentObservers()[0];

  // The site replaces #app: no mutation fires on the old root, only on body.
  first.observed[0].node.isConnected = false;
  const replacement = { isConnected: true };
  h.setRoot(replacement);
  h.fireBodyWatcher();

  const content = h.contentObservers();
  assert.equal(content.length, 2);
  assert.equal(first.disconnected, true);
  assert.equal(content[1].observed[0].node, replacement);
});

test('the body watcher does nothing while the root is still connected', () => {
  const feature = { id: 'f', ensure() {} };
  const h = loadObserver({ features: [feature] });
  h.observer.start([feature]);
  h.fireBodyWatcher(); // e.g. our toast was appended to <body>
  assert.equal(h.contentObservers().length, 1);
  assert.equal(h.contentObservers()[0].disconnected, false);
});
