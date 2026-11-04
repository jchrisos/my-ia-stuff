/* {{NAME}} — popup. Reuses content/settings.js (loaded first) so defaults live once. */
(function () {
  const { get, set } = globalThis.{{PREFIX}}.settings;

  const CHECKBOXES = ['behaviour.showButtons'];

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function patchFor(path, value) {
    const parts = path.split('.');
    // { behaviour: { showButtons: value } } — rebuild the nested group from the path.
    return parts.reduceRight((acc, key) => ({ [key]: acc }), value);
  }

  function showError() {
    const el = document.getElementById('save-error');
    if (!el) return;
    el.textContent = "Couldn't save — check that Chrome sync is available.";
    el.hidden = false;
  }

  function hideError() {
    const el = document.getElementById('save-error');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  async function render() {
    const s = await get();

    for (const radio of document.querySelectorAll('input[name="themeMode"]')) {
      radio.checked = radio.value === s.themeMode;
    }
    for (const id of CHECKBOXES) {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(getPath(s, id));
    }
  }

  async function save(patch) {
    try {
      await set(patch);
      hideError();
    } catch (e) {
      // Surface the failure and re-render from the reverted cache so the control does not
      // keep showing a value that was never persisted.
      showError();
      await render();
    }
  }

  function wire() {
    for (const radio of document.querySelectorAll('input[name="themeMode"]')) {
      radio.addEventListener('change', () => {
        if (radio.checked) save({ themeMode: radio.value });
      });
    }
    for (const id of CHECKBOXES) {
      document.getElementById(id)?.addEventListener('change', (e) => {
        save(patchFor(id, e.target.checked));
      });
    }
  }

  render();
  wire();
})();
