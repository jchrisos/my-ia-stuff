#!/usr/bin/env node
/* chrome-extension-scaffold — deterministic MV3 project generator.
 *
 * Copies assets/template/ and substitutes the placeholders, then writes generated PNG icons.
 * No dependencies: Node >= 18 (zlib is built in).
 *
 * Usage:
 *   node scripts/scaffold.mjs --name my-ext --match 'https://app.example.com/*' \
 *     --gate 'body#app' --dir ./my-ext
 *   node scripts/scaffold.mjs --help
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, '..', 'assets', 'template');
const VERSION = '0.1.0';

/* ------------------------------- arguments ------------------------------- */

const argv = process.argv.slice(2);

function usage() {
  return `Usage: node scripts/scaffold.mjs --name <kebab-case> --match <pattern> --gate <selector> [options]

Required:
  --name <kebab-case>     Extension name / package name (e.g. acme-sidebar)
  --match <pattern>       Match pattern; repeat or comma-separate for several
  --gate <selector>       Stable page marker that means "this is the app"; repeat or comma-separate

Options:
  --title <text>          Human title (default: titleised name)
  --description <text>    Store description, <= 132 chars (default: "<title> — a Chrome extension.")
  --prefix <ident>        JS/CSS namespace (default: initials of the name, e.g. acme-sidebar -> as)
  --shape <selector>      Stable shell that must exist before features run (default: the gates)
  --dir <path>            Output directory (default: ./<name>)
  --color <#rrggbb>       Icon accent colour (default: derived from the name)
  --force                 Write into an existing non-empty directory (never deletes anything)
  --help                  Show this help
`;
}

function parseArgs(list) {
  const out = { match: [], gate: [], shape: [] };
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (a === '--force') {
      out.force = true;
      continue;
    }
    if (!a.startsWith('--')) throw new Error(`unexpected argument: ${a}`);
    const key = a.slice(2);
    const value = list[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    if (key === 'match') out.match.push(...splitList(value));
    else if (key === 'gate') out.gate.push(...splitList(value));
    else if (key === 'shape') out.shape.push(...splitList(value));
    else out[key] = value;
  }
  return out;
}

const splitList = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);

/* ------------------------------- validation ------------------------------ */

const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const PREFIX_RE = /^[a-z][a-z0-9]*$/;
const MATCH_RE = /^<all_urls>$|^(\*|https?|file|ftp):\/\/[^/\s]+\/\S*$/;

function fail(msg) {
  console.error(`error: ${msg}\n`);
  process.stderr.write(usage());
  process.exit(1);
}

function titleise(name) {
  return name
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function defaultPrefix(name) {
  const words = name.split(/[-_]+/).filter(Boolean);
  let prefix = words.map((w) => w[0]).join('');
  if (prefix.length < 2) prefix = name.replace(/[^a-z0-9]/g, '').slice(0, 3);
  return prefix.replace(/[^a-z0-9]/g, '').slice(0, 12) || 'ext';
}

function assertSafeText(label, value) {
  // These values are substituted into JSON, HTML and Markdown without escaping, so keep
  // them to characters that mean the same thing in all three.
  if (/[<>"\\\n\r\t]/.test(value)) throw new Error(`${label} may not contain < > " \\ or control characters`);
}

/* ------------------------------ placeholder ------------------------------ */

function render(text, vars) {
  const out = text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole
  );
  const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) throw new Error(`unsubstituted placeholder(s): ${[...new Set(leftover)].join(', ')}`);
  return out;
}

/* --------------------------------- icons --------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`--color must be #rrggbb, got ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colourFor(name) {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hslToRgb(h % 360, 0.55, 0.44);
}

const SS = 4; // supersampling factor: smooth edges at 16px without a canvas library

function inRoundRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.min(Math.max(px, x0 + r), x1 - r);
  const cy = Math.min(Math.max(py, y0 + r), y1 - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

/** Rounded tile + a light frame and dot. A placeholder, but a legible one at 16px. */
function renderIcon(size, accent) {
  const rgba = Buffer.alloc(size * size * 4);
  const margin = size * 0.04;
  const radius = size * 0.22;
  const frameInset = size * 0.28;
  const stroke = Math.max(size * 0.07, 1);
  const innerRadius = size * 0.07;
  const dotR = size * 0.075;
  const c = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (!inRoundRect(px, py, margin, margin, size - margin, size - margin, radius)) continue;

          const inFrameOuter = inRoundRect(px, py, frameInset, frameInset, size - frameInset, size - frameInset, innerRadius);
          const inFrameInner = inRoundRect(
            px,
            py,
            frameInset + stroke,
            frameInset + stroke,
            size - frameInset - stroke,
            size - frameInset - stroke,
            Math.max(innerRadius - stroke, 0.5)
          );
          const inFrame = inFrameOuter && !inFrameInner;
          const inDot = (px - c) ** 2 + (py - c) ** 2 <= dotR * dotR;

          const [cr, cg, cb] = inFrame || inDot ? [255, 255, 255] : accent;
          r += cr;
          g += cg;
          b += cb;
          a += 255;
        }
      }

      const samples = SS * SS;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r / samples);
      rgba[i + 1] = Math.round(g / samples);
      rgba[i + 2] = Math.round(b / samples);
      rgba[i + 3] = Math.round(a / samples);
    }
  }
  return encodePng(size, rgba);
}

/* ------------------------------- generation ------------------------------ */

function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.DS_Store') continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...walk(abs, base));
    else out.push(relative(base, abs));
  }
  return out;
}

function main() {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    fail(e.message);
  }
  if (args.help) {
    process.stdout.write(usage());
    return;
  }

  try {
    if (!args.name) throw new Error('--name is required');
    if (!NAME_RE.test(args.name)) throw new Error('--name must be kebab-case: letters/digits, single hyphens (e.g. acme-sidebar)');
    if (!args.match.length) throw new Error('--match is required (the origin this extension augments)');
    if (!args.gate.length) throw new Error('--gate is required (a stable marker for "this is the app")');

    for (const p of args.match) {
      if (!MATCH_RE.test(p)) throw new Error(`not a valid match pattern: ${p} (expected scheme://host/path)`);
      if (p === '<all_urls>') throw new Error('<all_urls> is too broad for this template; list the origins you actually augment');
    }
    for (const s of [...args.gate, ...args.shape]) {
      if (!/^[^\n\r]+$/.test(s)) throw new Error(`invalid selector: ${s}`);
    }

    const title = args.title || titleise(args.name);
    const prefix = args.prefix || defaultPrefix(args.name);
    if (!PREFIX_RE.test(prefix)) throw new Error(`--prefix must be a lowercase JS identifier (letters/digits, starting with a letter): ${prefix}`);

    const description = args.description || `${title} — a Chrome extension.`;
    if (description.length > 132) throw new Error(`--description is ${description.length} chars; the Chrome Web Store limit is 132`);
    assertSafeText('--title', title);
    assertSafeText('--description', description);

    const iconColour = args.color ? hexToRgb(args.color) : colourFor(args.name);
    const shapes = args.shape.length ? args.shape : args.gate;

    const target = resolve(args.dir || args.name);
    if (existsSync(target)) {
      const entries = readdirSync(target).filter((e) => e !== '.DS_Store');
      if (entries.length && !args.force) {
        throw new Error(`${target} is not empty (${entries.length} entries). Pick another --dir, or pass --force to overwrite files.`);
      }
      if (!statSync(target).isDirectory()) throw new Error(`${target} exists and is not a directory`);
    }

    /* Pre-paint registration is an unconditional classList.add, so it may only cover
     * origins where every page is ours: concrete hosts, not loopback without a port. */
    const prepaint = args.match.filter((p) => {
      const m = /^(\*|https?):\/\/([^/]+)\//.exec(p);
      if (!m || m[1] === '*') return false;
      const hostPort = m[2];
      const host = hostPort.startsWith('[') ? hostPort.slice(0, hostPort.indexOf(']') + 1) : hostPort.split(':')[0];
      const hasPort = hostPort.startsWith('[') ? /]:\d+$/.test(hostPort) : /:\d+$/.test(hostPort);
      if (host.includes('*')) return false;
      const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
      return !(loopback && !hasPort);
    });

    const vars = {
      NAME: args.name,
      TITLE: title,
      DESCRIPTION: description,
      PREFIX: prefix,
      VERSION,
      GATES_JSON: JSON.stringify(args.gate),
      SHAPES_JSON: JSON.stringify(shapes),
      MATCHES_JSON: JSON.stringify(args.match),
      PREPAINT_JSON: JSON.stringify(prepaint),
    };

    const files = walk(TEMPLATE);
    const written = [];
    for (const rel of files) {
      const src = readFileSync(join(TEMPLATE, rel), 'utf8');
      const dst = join(target, rel);
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, render(src, vars));
      written.push(rel);
    }

    mkdirSync(join(target, 'icons'), { recursive: true });
    for (const size of [16, 32, 48, 128]) {
      writeFileSync(join(target, 'icons', `${size}.png`), renderIcon(size, iconColour));
      written.push(`icons/${size}.png`);
    }

    const relTarget = target.startsWith(process.cwd() + '/') ? target.slice(process.cwd().length + 1) : target;

    console.log(`Created ${args.name} in ${relTarget}`);
    console.log(`  namespace: ${prefix}    match: ${args.match.join(' ')}`);
    console.log(`  pre-paint origins: ${prepaint.length ? prepaint.join(' ') : 'none (theme applies at document_idle)'}`);
    console.log(`  files: ${written.length}`);
    console.log(`
Next:
  cd ${relTarget}
  make check && make test
  make load

Then:
  1. Fill in content/selectors.js (SEL.sampleRow / sampleSlot / sampleValue) and verify
     the gate/shape selectors against the real app.
  2. Replace or delete content/features/sample-action.js, registering any new feature in
     content/main.js AND in the manifest's js array (selectors.js first, main.js last).
  3. Replace icons/*.png with real artwork.
  4. Extend theme/dark.css against the real page, forcing :hover / [aria-selected] in DevTools.`);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}

main();
