#!/usr/bin/env node
/*
 * Exports the web build and finishes the parts `expo export` does not know
 * about: the deployment subpath and the service worker.
 *
 * GitHub Pages serves this app from /ComotV2/app, not from the site root, so
 * every root-absolute path in public/index.html has to be rebased. Those paths
 * stay root-absolute in the source because the app is a single-page build —
 * a relative href on the route /tenants/42 would resolve one directory too
 * deep. The service worker is then stamped with the hashed bundle names, which
 * only exist once the export has run.
 *
 * Usage:
 *   node scripts/export-web.mjs                    # served from /
 *   node scripts/export-web.mjs --base /ComotV2/app
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appJsonPath = path.join(projectRoot, 'app.json');
const distDir = path.join(projectRoot, 'dist');

/** Paths written as `/thing` in public/index.html that must follow the subpath. */
const REBASED_PATHS = ['/manifest.webmanifest', '/icons/apple-touch-icon-180.png', '/icons/icon-1024.png', '/icons/icon-192.png'];

function parseBase(argv) {
  const index = argv.indexOf('--base');
  const raw = index === -1 ? (process.env.EXPO_WEB_BASE_URL ?? '') : argv[index + 1];
  if (!raw || raw === '/') return '';
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

const base = parseBase(process.argv.slice(2));

function exportWeb() {
  const original = fs.readFileSync(appJsonPath, 'utf8');
  if (base) {
    const config = JSON.parse(original);
    config.expo.experiments = { ...config.expo.experiments, baseUrl: base };
    fs.writeFileSync(appJsonPath, `${JSON.stringify(config, null, 2)}\n`);
  }
  try {
    execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--clear'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  } finally {
    fs.writeFileSync(appJsonPath, original);
  }
}

function rebaseShell() {
  const file = path.join(distDir, 'index.html');
  let html = fs.readFileSync(file, 'utf8');

  const basePath = `${base}/`;
  const marker = "window.__COMOT_BASE_URL__ = '/';";
  if (!html.includes(marker)) {
    throw new Error('public/index.html no longer declares __COMOT_BASE_URL__; the service worker would register at the wrong scope');
  }
  html = html.replace(marker, `window.__COMOT_BASE_URL__ = '${basePath}';`);

  if (base) {
    for (const assetPath of REBASED_PATHS) {
      const next = html.replaceAll(`="${assetPath}"`, `="${base}${assetPath}"`);
      if (next === html) {
        throw new Error(`public/index.html does not reference ${assetPath}; update REBASED_PATHS in scripts/export-web.mjs`);
      }
      html = next;
    }
  }

  fs.writeFileSync(file, html);
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(distDir, path.join(entry.parentPath ?? entry.path, entry.name)));
}

function stampServiceWorker() {
  const file = path.join(distDir, 'sw.js');
  const source = fs.readFileSync(file, 'utf8');

  // `./` is what a navigation to the app root actually requests, and the shell
  // behind it is what makes an offline launch work. The rest is the JavaScript
  // needed to boot, plus the icons the installed window paints with.
  const precache = [
    './',
    './index.html',
    './manifest.webmanifest',
    './favicon.ico',
    './icons/icon-192.png',
    './icons/icon-512.png',
    ...listFiles(path.join(distDir, '_expo', 'static', 'js', 'web'))
      .filter((relative) => relative.endsWith('.js'))
      .map((relative) => `./${relative.split(path.sep).join('/')}`),
  ].filter((url) => url === './' || fs.existsSync(path.join(distDir, url.slice(2))));

  const buildId = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);

  const stamped = source
    .replace("'__BUILD_ID__'", JSON.stringify(buildId))
    .replace('__PRECACHE_URLS__', JSON.stringify(precache, null, 2));

  if (stamped.includes('__BUILD_ID__') || stamped.includes('__PRECACHE_URLS__')) {
    throw new Error('public/sw.js no longer contains the build tokens');
  }

  fs.writeFileSync(file, stamped);
  return { buildId, count: precache.length };
}

exportWeb();
rebaseShell();
const { buildId, count } = stampServiceWorker();

console.log(`\nWeb export ready in ${path.relative(process.cwd(), distDir)}`);
console.log(`  base path:      ${base || '/'}`);
console.log(`  service worker: build ${buildId}, ${count} precached files`);
