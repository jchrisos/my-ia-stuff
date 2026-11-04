/* {{NAME}} — rAF-coalesced MutationObserver + idempotent ensure() dispatch.
 *
 * Why an observer at all: the page owns its DOM and re-renders whenever it likes, which
 * removes injected nodes. Re-running every feature's ensure() on a coalesced frame is
 * cheaper and far more reliable than trying to hook the site's framework. */
(function (root) {
  const {{PREFIX}} = (root.{{PREFIX}} = root.{{PREFIX}} || {});
  let scheduled = false;
  let features = [];
  let observer = null;
  let observedRoot = null;
  const warned = new Set();

  function ensureAll() {
    scheduled = false;
    // Check the root BEFORE the shape gate: a replaced container would otherwise be
    // reported as a missing selector, and this recovery would never run.
    if (observedRoot && !observedRoot.isConnected) observe();
    if (!{{PREFIX}}.assertPageShape()) return;
    for (const f of features) {
      try {
        f.ensure(); // MUST be idempotent — guarded by data-{{PREFIX}}
      } catch (err) {
        // A feature that throws on every pass would otherwise log ~1/s forever.
        if (!warned.has(f.id)) {
          warned.add(f.id);
          console.warn('[{{NAME}}] feature failed', f.id, err);
        }
      }
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(ensureAll); // coalesce the page's mutation bursts
  }

  let rootWatcher = null;

  function observe() {
    if (observer) observer.disconnect();
    const sel = {{PREFIX}}.SEL.root;
    observedRoot = (sel && document.querySelector(sel)) || document.body;
    observer = new MutationObserver(schedule);
    observer.observe(observedRoot, { childList: true, subtree: true, characterData: true });

    // A replaced container produces NO mutation on the OLD root, so the content observer
    // alone can never notice it. Watch <body>'s direct children (no subtree/characterData,
    // so it stays cheap) and re-observe as soon as the root we follow goes away.
    if (rootWatcher) rootWatcher.disconnect();
    const container = document.body;
    if (container && container !== observedRoot) {
      rootWatcher = new MutationObserver(() => {
        if (!observedRoot || !observedRoot.isConnected) {
          observe();
          ensureAll();
        }
      });
      rootWatcher.observe(container, { childList: true });
    }
  }

  function start(list) {
    features = list;
    for (const f of features) {
      try {
        if (f.mount) f.mount();
      } catch (err) {
        console.warn('[{{NAME}}] mount failed', f.id, err);
      }
    }
    observe();
    ensureAll();
  }

  {{PREFIX}}.observer = { start, ensureAll };
})(globalThis);
