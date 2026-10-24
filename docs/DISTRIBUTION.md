# Shipping ComOt to people

How ComOt reaches a device, what the repository does on its own, and what only
an account holder can do. For the App Store listing text and the review
answers, see [`APP_STORE.md`](APP_STORE.md); for getting a build onto your own
iPhone while developing, [`IOS_TESTING.md`](IOS_TESTING.md).

| Route | Status | What a user does |
| --- | --- | --- |
| Install from Chrome or Edge (desktop, Android) | **Live** | Opens the app and accepts the install prompt |
| Add to Home Screen from Safari (iPhone, iPad) | **Live** | Share → Add to Home Screen |
| Any browser, no install | **Live** | <https://asscobara.github.io/ComotV2/app/> |
| App Store / TestFlight | Automated, needs an Apple account | Download from the store |
| Google Play | Automated, needs a Play account | Download from the store |

Everything starts at <https://asscobara.github.io/ComotV2/download.html>, which
detects the visitor's device and shows the right route. The three store badges
on the landing page point there.

## The web app really is an app

It is not a bookmark. The installed app gets its own icon and launcher entry,
opens in its own window with no browser chrome, keeps working when the network
drops, and on Android is installed as a WebAPK — it appears in the app drawer
and in Settings → Apps like any other app.

What it does not do, and what the native builds are for: push notifications
while the app is closed, and biometric sign-in.

### What makes Chrome offer to install it

Chrome shows "Install app" only when all of this holds, and silently shows
nothing when any one of it stops holding:

- a web app manifest with a name, a `standalone` display mode, a `start_url`,
  and 192px and 512px icons — `apps/mobile/public/manifest.webmanifest`;
- a service worker with a `fetch` handler, so the app survives being opened
  offline — `apps/mobile/public/sw.js`;
- HTTPS, which GitHub Pages provides.

`apps/mobile/scripts/check-web-install.mjs` asserts all of it against a real
export, and CI runs it on every pull request. That matters because a broken
install prompt is invisible: the app keeps working and nobody notices until
someone tries to install it.

The service worker serves navigations network-first so a returning user lands
on the newest deploy, falls back to the cached shell when offline, and serves
the content-hashed bundles straight from cache. It never touches anything
cross-origin, so Supabase responses are never cached. When a new worker takes
over mid-session the page reloads onto it.

Chrome fires `beforeinstallprompt`, the app keeps it, and the shell shows its
own Hebrew/English install bar at the bottom rather than relying on people
finding the address-bar icon. The landing page's Install button links to
`/app/?install=1`, which shows that bar even for someone who dismissed it
before. The browser's own install affordance keeps working either way.

### Why there is no Chrome Web Store listing

The Chrome Web Store stopped accepting hosted web apps years ago; it takes
extensions, and an extension whose only purpose is to open a website is the
kind of thing that gets rejected as low value. Installing the PWA *is* the
supported Chrome distribution route, and on Android it produces a real
installed app. If a Play Store listing is wanted on top of that, the Android
build below is the way, not the Chrome Web Store.

### Deploying the web app

`.github/workflows/deploy-web.yml` runs on every push to `main`:
`apps/mobile/scripts/export-web.mjs` exports the app for the `/ComotV2/app`
subpath, rebases the install paths, stamps the service worker with the hashed
bundle names, and the landing page is assembled around it.

To reproduce the deployed layout locally:

```bash
cd apps/mobile
pnpm run export:web --base /ComotV2/app
node scripts/check-web-install.mjs
```

Serve it from a directory structured like the site (`ComotV2/app/`) — the
install prompt needs the real path, and `localhost` counts as a secure origin.
Without `--base` the export is built for the site root, which is what
`pnpm web` already does for development.

## Apple

### What the repository already does

Given an Apple account and an Expo account, the whole pipeline is here. EAS
builds on Expo's Macs, so no Mac and no Xcode is needed. Build numbers come
from EAS (`appVersionSource: "remote"`), so an upload cannot collide with a
build number already used. Export compliance, Hebrew and English localizations,
account deletion, the privacy policy and the support page are all in place —
[`APP_STORE.md`](APP_STORE.md) lists them.

### What only the account holder can do

| Step | Why it cannot be automated |
| --- | --- |
| Enrol in the Apple Developer Program ($99/yr) | Apple verifies identity, and approval is not instant |
| Create the app record in App Store Connect | Needs the Apple ID |
| `pnpm dlx eas-cli@latest init` in `apps/mobile`, then commit | Writes `owner` and `extra.eas.projectId` into `app.json`, tying builds to an Expo account |
| Fill the listing and submit for review | The legal declarations are the account holder's |

Until `eas init` has been run and committed, every EAS workflow in this
repository fails — `pnpm release:check` reports it as the first blocker.

### Repository secrets

Add these under *Settings → Secrets and variables → Actions*:

| Secret | Needed for | Where it comes from |
| --- | --- | --- |
| `EXPO_TOKEN` | every EAS workflow | <https://expo.dev/settings/access-tokens> |
| `ASC_API_KEY_P8` | submitting to Apple | the contents of the `.p8` file |
| `ASC_API_KEY_ID` | submitting to Apple | shown next to the key |
| `ASC_API_KEY_ISSUER_ID` | submitting to Apple | shown above the key list |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | submitting to Play | the service account JSON |

The Apple key comes from App Store Connect → *Users and Access → Integrations →
App Store Connect API*, with the **App Manager** role. An API key rather than
an Apple ID, because an unattended job cannot answer a two-factor prompt. The
workflows write the key to a file on the runner for the length of the job and
`eas.json`'s `production-ci` submit profile reads the path from the
environment; nothing is ever committed.

### Releasing

From the Actions tab, run **Mobile Build (EAS)** with platform `ios`, profile
`production` and submit enabled. Or locally:

```bash
cd apps/mobile
pnpm dlx eas-cli@latest build --platform ios --profile production --auto-submit
```

The local command signs in to Apple interactively and uses the `production`
submit profile; CI uses `production-ci` with the API key. **Mobile Submit (EAS
Submit)** sends a build that already exists, which is what to use when a
submission failed but the build was fine.

After processing, the build appears in TestFlight. Test it there, then attach
it to a version in App Store Connect, paste the listing from
[`APP_STORE.md`](APP_STORE.md), and submit.

Once the app is public, paste its URL into `STORE_LINKS` at the bottom of
`apps/landing/download.html` and the badge goes live. A TestFlight public link
goes in the same place.

### Before submitting

```bash
pnpm release:check
```

It checks the things that actually sink submissions: the backend answering, the
EAS project being linked, no placeholder support address on the pages App
Review opens, and the public site serving its manifest and service worker.

The backend one is not a formality. ComOt is unusable without it: the reviewer
signs in, gets "can't reach the server", and rejects under guideline 2.1. A
free Supabase project pauses after about a week of inactivity, which can happen
*during* review — for a submitted app a paid plan is worth it for that reason
alone.

## Android and Google Play

`apps/mobile/app.json` sets the package name to `com.comot.app`, and the same
workflows build and submit Android. Submitting needs a Google Play Console
account ($25, one-off) and a service account JSON in
`GOOGLE_SERVICE_ACCOUNT_JSON`; the `production-ci` profile uploads to the
`internal` track as a draft, so nothing goes public by accident.

Worth knowing before paying for it: on Android, installing from Chrome already
produces a real installed app. A Play listing buys discoverability and push
notifications, not the installed-app experience.

## When the install prompt does not appear

- **Already installed.** Chrome offers nothing when the app is installed. Check
  `chrome://apps`, or look for an "Open in app" icon instead.
- **The service worker did not register.** DevTools → Application → Service
  Workers should show one activated, scoped to `/ComotV2/app/`. A worker from
  an older deploy stuck in "waiting" is cleared by *Unregister* and a reload.
- **Not Chromium.** Firefox does not install web apps on the desktop. Safari
  does, through *Add to Dock* on macOS and *Add to Home Screen* on iOS.
- **iPhone, but not Safari.** iOS only allows home-screen installs from Safari,
  regardless of which browser is set as default.
- **Dismissed before.** The in-app bar remembers a dismissal. Opening
  `/app/?install=1` shows it again; so does clearing site data.
