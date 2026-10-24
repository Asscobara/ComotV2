#!/usr/bin/env node
/*
 * Reports what still stands between this repository and an app people can
 * download from the Apple and Google stores.
 *
 * Everything here is something that has bitten a submission before: a backend
 * that stopped resolving, a placeholder support address on a page App Review
 * opens, an EAS project that was never linked so the build workflows cannot
 * run. Run it before kicking off a release:
 *
 *   pnpm release:check
 *
 * Exits non-zero if any blocker is open. Network checks degrade to a warning
 * when there is no connectivity, so this stays usable offline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://asscobara.github.io/ComotV2';
const PLACEHOLDER_SUPPORT_EMAIL = 'support@comot.app';

const results = [];

function record(status, title, detail) {
  results.push({ status, title, detail });
}

const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));
const readText = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

async function head(url) {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/* ---- the app's own configuration ------------------------------------- */

function checkAppConfig() {
  const { expo } = readJson('apps/mobile/app.json');

  if (expo.extra?.eas?.projectId && expo.owner) {
    record('pass', 'EAS project linked', `${expo.owner} / ${expo.extra.eas.projectId}`);
  } else {
    record(
      'blocker',
      'EAS project not linked',
      'Run `pnpm dlx eas-cli@latest init` in apps/mobile and commit the app.json change. Until then every EAS build and submit fails.'
    );
  }

  const ios = expo.ios?.bundleIdentifier;
  const android = expo.android?.package;
  if (ios && android) {
    record('pass', 'Store identifiers set', `iOS ${ios}, Android ${android}`);
  } else {
    record('blocker', 'Store identifiers missing', `iOS bundleIdentifier: ${ios ?? 'unset'}, Android package: ${android ?? 'unset'}`);
  }

  const easJson = readJson('apps/mobile/eas.json');
  if (easJson.submit?.['production-ci']) {
    record('pass', 'Unattended submit profile present', 'eas.json submit.production-ci');
  } else {
    record('blocker', 'No unattended submit profile', 'The submit workflows expect eas.json submit.production-ci');
  }
}

/* ---- things App Review opens ------------------------------------------ */

function checkSupportAddress() {
  const pages = ['apps/landing/support.html', 'apps/landing/privacy.html'];
  const stillPlaceholder = pages.filter((page) => readText(page).includes(PLACEHOLDER_SUPPORT_EMAIL));

  if (stillPlaceholder.length === 0) {
    record('pass', 'Support address is real', 'no placeholder left on the public pages');
  } else {
    record(
      'blocker',
      'Placeholder support address',
      `${PLACEHOLDER_SUPPORT_EMAIL} still appears in ${stillPlaceholder.join(', ')}. App Review opens both pages.`
    );
  }
}

/* ---- the live deployment ---------------------------------------------- */

async function checkBackend() {
  const env = readText('apps/mobile/.env');
  const url = env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  const key = env.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();

  if (!url || !key) {
    record('blocker', 'Backend not configured', 'apps/mobile/.env is missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
    return;
  }

  const result = await head(`${url}/auth/v1/health?apikey=${encodeURIComponent(key)}`);
  if (result.ok) {
    record('pass', 'Backend reachable', url);
  } else {
    record(
      'blocker',
      'Backend unreachable',
      `${url} answered ${result.status ?? result.error}. A reviewer who cannot sign in rejects under guideline 2.1, and an installed web app shows "can't reach the server". See supabase/README.md.`
    );
  }
}

async function checkSite() {
  const pages = [
    ['app shell', `${SITE}/app/`],
    ['web manifest', `${SITE}/app/manifest.webmanifest`],
    ['service worker', `${SITE}/app/sw.js`],
    ['download page', `${SITE}/download.html`],
    ['privacy policy', `${SITE}/privacy.html`],
    ['support page', `${SITE}/support.html`],
  ];

  const checked = await Promise.all(pages.map(async ([label, url]) => [label, url, await head(url)]));
  const broken = checked.filter(([, , result]) => !result.ok);

  if (broken.length === 0) {
    record('pass', 'Public site live', `${pages.length} URLs answered, including the service worker`);
    return;
  }

  // No connectivity at all is a different problem from a bad deploy.
  if (broken.length === pages.length && broken.every(([, , result]) => result.error)) {
    record('warn', 'Could not reach the public site', broken[0][2].error);
    return;
  }

  for (const [label, url, result] of broken) {
    record('blocker', `Public site: ${label} missing`, `${url} answered ${result.status ?? result.error}`);
  }
}

/* ---- store listings ---------------------------------------------------- */

function checkStoreLinks() {
  const page = readText('apps/landing/download.html');
  const block = page.match(/const STORE_LINKS = \{([\s\S]*?)\};/)?.[1] ?? '';
  const live = [...block.matchAll(/(\w+):\s*'([^']+)'/g)].map((match) => match[1]);

  if (live.length > 0) {
    record('pass', 'Store links published', live.join(', '));
  } else {
    record(
      'todo',
      'No store links yet',
      'Fill STORE_LINKS in apps/landing/download.html once a listing or TestFlight group exists. Browser install works regardless.'
    );
  }
}

/* ---- report ------------------------------------------------------------ */

const ICONS = { pass: 'ok     ', blocker: 'BLOCKED', warn: 'warn   ', todo: 'todo   ' };

checkAppConfig();
checkSupportAddress();
checkStoreLinks();
await checkBackend();
await checkSite();

console.log('\nRelease readiness\n');
for (const { status, title, detail } of results) {
  console.log(`  ${ICONS[status]}  ${title}`);
  console.log(`           ${detail}\n`);
}

const blockers = results.filter((result) => result.status === 'blocker');
if (blockers.length === 0) {
  console.log('No blockers. Ship it.\n');
} else {
  console.log(`${blockers.length} blocker(s) between here and a store release.\n`);
  process.exit(1);
}
