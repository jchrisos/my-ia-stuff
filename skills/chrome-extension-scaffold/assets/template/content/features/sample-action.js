/* {{NAME}} — Feature: sample action.
 *
 * This is the pattern to copy for every new feature:
 *   1. ensure() is IDEMPOTENT: it finds the host nodes, injects the button once (guarded by
 *      data-{{PREFIX}}), and heals stale attributes on every pass. The page re-renders and
 *      reuses nodes, so "it exists" is not the same as "it is correct".
 *   2. mount() registers ONE delegated listener, never one per button.
 *   3. The payload is read from the LIVE DOM at click time. Capturing it in a closure breaks
 *      as soon as the page swaps the row's content without replacing the node.
 *   4. Selectors come from {{PREFIX}}.SEL only.
 *
 * It no-ops until sampleRow/sampleSlot/sampleValue are filled in (see content/selectors.js).
 */
(function (root) {
  const {{PREFIX}} = (root.{{PREFIX}} = root.{{PREFIX}} || {});

  // Inline SVG — deliberately NOT chrome.runtime.getURL(): that forces a
  // web_accessible_resources entry and exposes extension internals to the page.
  const ICON =
    '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M5 1h7a2 2 0 0 1 2 2v7h-2V3H5V1zM3 5h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v6h7V7H3z"/>' +
    '</svg>';

  const ATTR = 'sample-action';

  function enabled() {
    return Boolean({{PREFIX}}.settings.cached().behaviour.showButtons);
  }

  function removeButtons() {
    for (const btn of document.querySelectorAll(`[data-{{PREFIX}}="${ATTR}"]`)) btn.remove();
  }

  function ensure() {
    if (!enabled()) return removeButtons();
    const slotSel = {{PREFIX}}.SEL.sampleSlot;
    const valueSel = {{PREFIX}}.SEL.sampleValue;
    if (!slotSel || !valueSel) return; // not configured yet: stay invisible

    for (const row of document.querySelectorAll({{PREFIX}}.SEL.sampleRow || slotSel)) {
      const slot = row.querySelector(slotSel) || row;
      if (slot.querySelector(`[data-{{PREFIX}}="${ATTR}"]`)) continue;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.{{PREFIX}} = ATTR;
      btn.className = '{{PREFIX}}-action-btn';
      btn.innerHTML = ICON;
      btn.title = 'Copy value';
      btn.setAttribute('aria-label', 'Copy value');
      slot.appendChild(btn);
    }
  }

  function mount() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest(`[data-{{PREFIX}}="${ATTR}"]`);
      if (!btn) return;
      // Resolve everything now, from the node that is on screen right now.
      const row = btn.closest({{PREFIX}}.SEL.sampleRow || '*') || document;
      const valueEl = row.querySelector({{PREFIX}}.SEL.sampleValue);
      if (!valueEl) return;
      const value = {{PREFIX}}.dom.ownText(valueEl);
      if (!value) return;

      {{PREFIX}}.copyText(value).then((res) => {
        if (res.ok) {{PREFIX}}.toast.show('Copied.');
        else {{PREFIX}}.toast.show('Copy failed', 'error');
      });
    });
  }

  {{PREFIX}}.features = {{PREFIX}}.features || {};
  {{PREFIX}}.features.sampleAction = { id: ATTR, ensure, mount };
})(globalThis);
