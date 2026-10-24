#!/usr/bin/env node
/*
 * Asserts that an exported web build still meets the bar Chrome sets before it
 * will offer "Install app": a reachable manifest with a name, a 192px and a
 * 512px icon, a standalone display mode, and a service worker that handles
 * fetch. Every one of those is easy to break without noticing — the app keeps
 * working, the install prompt just silently stops appearing.
 *
 * Run after scripts/export-web.mjs. Exits non-zero on the first failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const failures = [];
const checks = [];

function check(label, assertion) {
  try {
    const detail = assertion();
    checks.push(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures.push(label);
    checks.push(`  FAIL  ${label} — ${error.message}`);
  }
}

function read(relative) {
  const file = path.join(distDir, relative);
  if (!fs.existsSync(file)) throw new Error(`${relative} is missing from the export`);
  return fs.readFileSync(file, 'utf8');
}

const html = fs.existsSync(path.join(distDir, 'index.html')) ? read('index.html') : '';

check('the export exists', () => {
  if (!html) throw new Error('dist/index.html is missing — run scripts/export-web.mjs first');
  return path.relative(process.cwd(), distDir);
});

check('the shell links a manifest', () => {
  const match = html.match(/<link rel="manifest" href="([^"]+)"/);
  if (!match) throw new Error('no <link rel="manifest"> in index.html');
  return match[1];
});

check('the shell registers a service worker', () => {
  if (!html.includes('serviceWorker.register')) throw new Error('index.html never calls serviceWorker.register');
  const match = html.match(/window\.__COMOT_BASE_URL__ = '([^']+)'/);
  if (!match) throw new Error('__COMOT_BASE_URL__ was not stamped, so the worker would register at the wrong scope');
  return `scope ${match[1]}`;
});

check('the service worker is stamped and handles fetch', () => {
  const sw = read('sw.js');
  if (sw.includes('__BUILD_ID__') || sw.includes('__PRECACHE_URLS__')) {
    throw new Error('sw.js still contains build tokens');
  }
  if (!/addEventListener\('fetch'/.test(sw)) {
    throw new Error("sw.js has no 'fetch' listener, so Chrome will not treat the app as installable");
  }
  const precached = JSON.parse(sw.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/)[1]);
  const missing = precached.filter((url) => url !== './' && !fs.existsSync(path.join(distDir, url.slice(2))));
  if (missing.length) throw new Error(`precaches files that were not exported: ${missing.join(', ')}`);
  if (!precached.some((url) => url.endsWith('.js'))) throw new Error('no JavaScript bundle was precached');
  return `${precached.length} files precached`;
});

check('the manifest is installable', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  if (!manifest.name && !manifest.short_name) throw new Error('needs a name or short_name');
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) {
    throw new Error(`display "${manifest.display}" does not qualify as an installable app`);
  }
  if (!manifest.start_url) throw new Error('needs a start_url');

  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons?.find((entry) => entry.sizes === size);
    if (!icon) throw new Error(`needs a ${size} icon`);
    if (!fs.existsSync(path.join(distDir, icon.src.replace(/^\.\//, '')))) {
      throw new Error(`${icon.src} is declared but was not exported`);
    }
  }
  if (!manifest.icons.some((icon) => icon.purpose?.split(' ').includes('maskable'))) {
    throw new Error('needs a maskable icon, or Android will letterbox the launcher icon');
  }
  return `${manifest.icons.length} icons, display ${manifest.display}`;
});

console.log('Install readiness:');
console.log(checks.join('\n'));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed. The app would still run, but Chrome would not offer to install it.`);
  process.exit(1);
}

console.log('\nThe exported build is installable.');
