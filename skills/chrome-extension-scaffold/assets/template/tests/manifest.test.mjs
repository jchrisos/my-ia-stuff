// {{NAME}} — manifest invariants.
//
// These are the mistakes that are invisible at load time and only show up as "the
// extension does nothing" on someone else's machine:
//  - a match pattern that pins a port (it matches ONLY that port),
//  - a file referenced by the manifest that is not on disk (the whole content-script
//    bundle fails to load, silently),
//  - a content script ordered before its dependency.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const root = new URL('../', import.meta.url);

const exists = (p) => existsSync(new URL(p, root));

test('manifest version matches package.json', () => {
  assert.equal(manifest.version, pkg.version);
});

test('description fits the Chrome Web Store limit (132 chars)', () => {
  assert.ok(manifest.description.length <= 132, `description is ${manifest.description.length} chars`);
});

test('permissions are exactly the ones the extension uses', () => {
  assert.deepEqual([...manifest.permissions].sort(), ['scripting', 'storage']);
});

test('no web_accessible_resources (inline assets keep extension internals unexposed)', () => {
  assert.equal(manifest.web_accessible_resources, undefined);
});

test('host_permissions are valid match patterns', () => {
  assert.ok(manifest.host_permissions.length > 0);
  for (const p of manifest.host_permissions) {
    assert.match(p, /^(https?|\*):\/\/[^/]+\/.*$/, `not a match pattern: ${p}`);
  }
});

test('loopback match patterns carry no explicit port', () => {
  // "Match patterns match all ports unless an explicit port is specified." Pinning
  // localhost:4040 silently disables the extension whenever the app moves ports.
  for (const p of manifest.host_permissions) {
    const host = new URL(p.replace('*://', 'http://')).hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      assert.doesNotMatch(p, /:(?!\/)\d+/, `loopback pattern pins a port: ${p}`);
    }
  }
});

test('service worker is declared as an ES module', () => {
  assert.equal(manifest.background.type, 'module');
  assert.ok(exists(manifest.background.service_worker), 'service worker missing on disk');
});

test('every file referenced by the manifest exists', () => {
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap((cs) => [...(cs.js || []), ...(cs.css || [])]),
  ];
  for (const f of files) assert.ok(exists(f), `missing file referenced by manifest: ${f}`);
});

test('content scripts load selectors first and main last', () => {
  for (const cs of manifest.content_scripts) {
    if (!cs.js) continue;
    assert.equal(cs.js[0], 'content/selectors.js', 'selectors.js must load first');
    assert.equal(cs.js.at(-1), 'content/main.js', 'main.js must load last');
  }
});

test('every content-script file is covered by make check', () => {
  // The Makefile walks content/, background/, theme/, popup/ and tests/. A file placed
  // anywhere else would escape syntax checking, so the layout is pinched here.
  for (const cs of manifest.content_scripts) {
    for (const f of cs.js || []) assert.match(f, /^(content|theme|background)\//, `${f} is outside the checked tree`);
  }
});
