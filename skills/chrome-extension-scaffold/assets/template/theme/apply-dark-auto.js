/* {{NAME}} — pre-paint theme bootstrap (auto).
 * Same contract as apply-dark.js: synchronous, no awaits, safe at document_start. */
if (matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('{{PREFIX}}-dark');
}
