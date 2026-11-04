/* {{NAME}} — clipboard helper.
 *
 * No permission is needed on an https page (a secure context): navigator.clipboard works
 * from a content script, and the click supplies the transient activation Chrome requires.
 * There is no `clipboardWrite` key to add to the manifest. */
(function (root) {
  const {{PREFIX}} = (root.{{PREFIX}} = root.{{PREFIX}} || {});

  /** @returns {Promise<{ok:boolean, legacy?:boolean, error?:string}>} */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (err) {
      return legacyCopy(text) ? { ok: true, legacy: true } : { ok: false, error: err?.name ?? 'unknown' };
    }
  }

  /** Fallback for a blurred/older document. execCommand is deprecated but functional.
   *  Moving focus to the temporary textarea would strand keyboard users, so restore it. */
  function legacyCopy(text) {
    const previous = document.activeElement;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = (() => {
      try {
        return document.execCommand('copy');
      } catch (e) {
        return false;
      }
    })();
    ta.remove();
    if (previous && typeof previous.focus === 'function') {
      try {
        previous.focus();
      } catch (e) {
        /* the element may have been removed by a re-render */
      }
    }
    return ok;
  }

  {{PREFIX}}.copyText = copyText;
})(globalThis);
