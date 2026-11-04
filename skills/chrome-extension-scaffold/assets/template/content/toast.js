/* {{NAME}} — transient, accessible toasts. */
(function (root) {
  const {{PREFIX}} = (root.{{PREFIX}} = root.{{PREFIX}} || {});
  let el = null;
  let timer = 0;
  let seq = 0;

  function init() {
    if (el) return;
    el = document.createElement('div');
    el.className = '{{PREFIX}}-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    // <body>, not <html>: the toast belongs to the rendered document.
    (document.body || document.documentElement).appendChild(el);
  }

  /** @param {string} msg @param {'info'|'error'} [kind] */
  function show(msg, kind) {
    init();
    const isError = kind === 'error';
    const my = ++seq;

    el.dataset.kind = kind || 'info';
    // Errors are announced assertively; informational toasts politely.
    el.setAttribute('role', isError ? 'alert' : 'status');
    el.setAttribute('aria-live', isError ? 'assertive' : 'polite');

    // Clear first, then paint on the next frame: repeating the exact same message would
    // otherwise be a no-op mutation and never be re-announced.
    el.textContent = '';
    const paint = () => {
      if (my === seq) el.textContent = msg;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(paint);
    else paint();

    el.classList.add('{{PREFIX}}-toast--show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('{{PREFIX}}-toast--show'), 2400);
  }

  {{PREFIX}}.toast = { init, show };
})(globalThis);
