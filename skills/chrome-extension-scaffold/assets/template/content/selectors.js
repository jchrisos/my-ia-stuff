/* {{NAME}} — SINGLE SOURCE OF TRUTH for every DOM selector.
 *
 * Rules that keep this file useful:
 *  - No feature may contain a selector of its own. When the site changes, this is the only
 *    file you should need to edit.
 *  - If the site ships CSS-module hashes (`_panel_ab12cd`), match by attribute prefix
 *    (`[class*="_panel_"]`). The hash changes per deploy; the prefix usually survives.
 *  - Verify selectors against a named site version/date and record it in SITE_VERIFIED.
 *    When the shape check starts warning, the site moved and this file is the map.
 */
(function (root) {
  const {{PREFIX}} = (root.{{PREFIX}} = root.{{PREFIX}} || {});

  {{PREFIX}}.SITE_VERIFIED = 'not verified yet — write the date + site version here';

  /* Page gate.
   * Content scripts are injected on every page the manifest matches, which is often broader
   * than "pages this extension understands". GATES is an OR list of stable markers for the
   * app shell (a root id, a meta tag, a data attribute) — never a CSS-module hash, and never
   * something that only exists once data is loaded. SHAPES is the AND list that must hold
   * before features run; it should also be limited to the stable shell, because "nothing
   * selected yet" is a normal state, not a DOM change. */
  const GATES = {{GATES_JSON}};
  const SHAPES = {{SHAPES_JSON}};

  // Exposed so tests can drive the real lists instead of hard-coding them.
  {{PREFIX}}.GATES = GATES;
  {{PREFIX}}.SHAPES = SHAPES;

  {{PREFIX}}.SEL = {
    /* Container the MutationObserver follows. null => follow <body>. Prefer the app root:
       watching <body> means every unrelated DOM change schedules a pass. */
    root: null,

    /* ---- TODO: replace with real selectors, then build features off them. ----
     * The sample feature (content/features/sample-action.js) reads these three and no-ops
     * while any of them is null, so the extension is safe to load before you finish this.
     * Delete the sample feature if you do not want it. */
    sampleRow: null, // e.g. 'ul[class*="_item_"] > li'
    sampleSlot: null, // where the button goes, e.g. 'div[class*="_toolbar_"]'
    sampleValue: null, // the text to copy, e.g. 'span[class*="_title_"]'
  };

  /** True when this page is the app we augment. Cheap and silent: no logging when false. */
  {{PREFIX}}.isTargetPage = function () {
    return GATES.some((sel) => document.querySelector(sel) !== null);
  };

  let shapeWarned = false;

  /** Warn ONCE if the stable shell is gone. Returns false when it is.
   * The per-feature ensure() early returns are the correct guard for "nothing selected";
   * putting those selectors here would warn on every empty page. */
  {{PREFIX}}.assertPageShape = function () {
    const missing = SHAPES.filter((sel) => !document.querySelector(sel));
    if (missing.length) {
      if (!shapeWarned) {
        shapeWarned = true;
        console.warn(
          `[{{NAME}}] page DOM changed — missing: ${missing.join(', ')}. ` +
            'Verified against ' + {{PREFIX}}.SITE_VERIFIED + '. Features will no-op.'
        );
      }
      return false;
    }
    return true;
  };

  /** DOM helpers shared by features. Keep them site-agnostic. */
  {{PREFIX}}.dom = {
    /** Trimmed text of an element, or '' when it is missing. */
    text(el) {
      return el ? (el.textContent || '').trim() : '';
    },

    /** Text with our injected nodes stripped. Use this, not text(), on containers we
     *  mutate: otherwise the button's own label ("Copy") leaks into the copied value. */
    ownText(el) {
      if (!el) return '';
      const clone = el.cloneNode(true);
      clone.querySelectorAll('[data-{{PREFIX}}]').forEach((n) => n.remove());
      return (clone.textContent || '').trim();
    },

    /** Trimmed attribute value, or '' when missing. */
    attr(el, name) {
      return el ? (el.getAttribute(name) || '').trim() : '';
    },

    /** querySelector with an explicit scope, tolerant of a null selector. */
    first(selector, scope) {
      if (!selector) return null;
      return (scope || document).querySelector(selector);
    },
  };
})(globalThis);
