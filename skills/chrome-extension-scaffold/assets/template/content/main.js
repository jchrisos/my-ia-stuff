/* {{NAME}} — content-script bootstrap. Runs at document_idle (all modules loaded). */
(function (root) {
  const {{PREFIX}} = (root.{{PREFIX}} = root.{{PREFIX}} || {});

  async function boot() {
    // The manifest matches pages the site may serve for other purposes, so the gate is the
    // first thing that runs. When it is false, do nothing at all — no console output, no
    // theming, no DOM writes.
    if (!{{PREFIX}}.isTargetPage()) {
      // The pre-paint theme script is an unconditional classList.add, so undo it here in
      // case this page matched a pre-painted origin but is not the app.
      document.documentElement.classList.remove('{{PREFIX}}-dark');
      return;
    }
    // Scope page-CSS affordances in extension.css to the real app.
    document.documentElement.classList.add('{{PREFIX}}-on');

    await {{PREFIX}}.settings.get(); // prime the cache before the first ensure()
    {{PREFIX}}.toast.init();
    {{PREFIX}}.theme.init();

    const features = [{{PREFIX}}.features.sampleAction].filter(Boolean);

    // A feature file that failed to load (manifest typo, syntax error, stale extension
    // load) would otherwise vanish silently — surface it instead of a half-working bundle.
    const missing = ['sampleAction'].filter((k) => !{{PREFIX}}.features[k]);
    if (missing.length) console.warn('[{{NAME}}] features failed to load:', missing.join(', '));

    {{PREFIX}}.observer.start(features);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(globalThis);
