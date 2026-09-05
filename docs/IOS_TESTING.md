# Testing ComOt on your iPhone

There are three ways to get ComOt onto your phone. They differ in cost, setup effort, and
how close they are to the real shipped app.

| Path | Cost | Setup | Real native app? | Best for |
| --- | --- | --- | --- | --- |
| [A. Home-screen web app](#a-home-screen-web-app) | Free | ~2 min, phone only | No (Safari engine) | Trying the product right now |
| [B. Expo Go](#b-expo-go) | Free | ~10 min, needs a computer | Yes, sandboxed | Day-to-day development |
| [C. TestFlight / ad-hoc build](#c-testflight--ad-hoc-build) | $99/yr Apple Developer | ~1 hr first time | Yes, the real `.ipa` | Real testing, sharing with neighbours |

Start with **A** to see the product in a couple of minutes. Move to **C** when you want the
genuine App Store artifact.

---

## A. Home-screen web app

The web build is already deployed, so nothing needs to be built. iOS installs it as a
standalone app with its own icon and no Safari toolbars.

1. Open **Safari** on the iPhone (this does not work from Chrome) and go to:

   <https://asscobara.github.io/ComotV2/app/>

2. Tap the **Share** button (the square with an arrow, in the bottom toolbar).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Launch **ComOt** from your home screen.

You get the ComOt icon, a full-screen window, Hebrew RTL layout, and the live Supabase
backend — sign-up, chat, faults, events, polls, budget and notifications all work.

What you do *not* get on this path: push notifications when the app is closed, and native
biometric login. In-app notifications (the bell and its live badge) work fine.

---

## B. Expo Go

Expo Go is a free host app from the App Store that loads ComOt's JavaScript from a dev
server on your computer. Every dependency in this project ships inside Expo Go, so no
custom build is required. Changes reload instantly, which makes this the fastest loop for
development.

You need a computer with Node.js 22+ and pnpm, on any network:

```bash
git clone https://github.com/Asscobara/ComotV2.git
cd ComotV2
pnpm install
cd apps/mobile
pnpm exec expo start --tunnel
```

Then install **Expo Go** from the App Store and scan the QR code from the terminal with
the iPhone camera. `--tunnel` routes through Expo's relay, so the phone and computer do
not have to be on the same Wi-Fi.

The dev server has to stay running while you use the app.

---

## C. TestFlight / ad-hoc build

This produces the real signed `.ipa` — the same artifact that would go to the App Store.
Builds run on Expo's cloud Macs, so **you do not need a Mac or Xcode**.

### One-time prerequisites

1. **Apple Developer Program** — enrol at <https://developer.apple.com/programs/> ($99/yr).
   Enrolment approval is not instant; Apple verifies your identity first.
2. **Expo account** — free, at <https://expo.dev/signup>.

### Choose the bundle identifier before the first build

`apps/mobile/app.json` currently sets:

```json
"ios": { "bundleIdentifier": "com.comot.app" }
```

This string is permanent once the app exists in App Store Connect, so change it now if you
want something else (reverse-DNS of a domain you own is the convention, e.g.
`il.co.comot.app`).

### Link the project to Expo

Run once from your computer, in the repo:

```bash
cd apps/mobile
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest init
```

`init` creates the Expo project and writes `extra.eas.projectId` plus `owner` into
`app.json`. **Commit that change** — the GitHub Actions workflows need it.

To also enable over-the-air JS updates (see [Shipping changes](#shipping-changes-after-the-first-build)):

```bash
pnpm dlx eas-cli@latest update:configure
```

### Build it

Two equivalent options.

**From your computer:**

```bash
cd apps/mobile

# Installs directly onto your own registered iPhone, no App Store review:
pnpm dlx eas-cli@latest build --platform ios --profile preview

# Or a TestFlight build you can share with neighbours:
pnpm dlx eas-cli@latest build --platform ios --profile production --auto-submit
```

**From GitHub, with no local setup:** add an
[access token](https://expo.dev/settings/access-tokens) as the `EXPO_TOKEN` repository
secret (*Settings > Secrets and variables > Actions*), then run the
**Mobile Build (EAS)** workflow from the *Actions* tab and pick a platform and profile.

Either way, EAS asks for your Apple credentials on the first run and then generates and
stores the signing certificate and provisioning profile for you. Answer yes when it offers
to manage credentials — there is no certificate handling to do by hand.

### Install it

**`preview` profile (ad-hoc).** EAS registers your device during the build; if it has not
seen the phone yet it prints a registration URL to open on the iPhone. When the build
finishes, open its page on <https://expo.dev> from the phone's Safari and tap **Install**.
Only devices registered this way can install the build.

**`production` profile (TestFlight).** With `--auto-submit` the build is uploaded to App
Store Connect automatically. Processing there takes a while, after which the build appears
in the **TestFlight** app on your phone. Add neighbours as internal testers in App Store
Connect to share it with them; internal testing needs no App Store review.

### Shipping changes after the first build

Once a build is installed, JavaScript-only changes do not need a rebuild:

```bash
cd apps/mobile
pnpm dlx eas-cli@latest update --channel preview --message "what changed"
```

or run the **Mobile Update (EAS Update)** workflow from the Actions tab. The app picks the
update up on next launch.

A new native build *is* required when you add a native module, or change plugins,
permissions, the app icon, or the bundle identifier in `app.json`.

---

## Build profiles

Defined in `apps/mobile/eas.json`:

| Profile | Distribution | Notes |
| --- | --- | --- |
| `development` | internal | Dev client with the debug menu and fast refresh on a real device |
| `simulator` | internal | iOS Simulator build; needs a Mac |
| `preview` | internal | Release build, ad-hoc install on registered devices |
| `production` | store | TestFlight and App Store |

`appVersionSource` is `remote`, so EAS owns the build number and increments it per
production build. You will not hit "this build number already exists" on upload.

---

## Troubleshooting

**"Can't reach the server" / "server can't be found"** — the app loaded but the backend did
not answer. The most common cause by far is a paused Supabase project: free projects pause
after about a week of inactivity, and a paused project stops resolving in DNS. Restore it
from the Supabase dashboard; see [`supabase/README.md`](../supabase/README.md). To confirm
this is the cause, check whether the API hostname resolves at all:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<project-ref>.supabase.co/rest/v1/
```

A `Could not resolve host` error means the project is paused or deleted. Note that the
home-screen web app and the landing page are static files served by GitHub Pages, so they
keep working even when the backend is down — a loading app does not mean a healthy backend.

## Notes

- **Supabase configuration** is read from `apps/mobile/.env`, which is committed and holds
  only the public project URL and publishable key. EAS picks it up automatically, so builds
  point at the live project with no extra configuration.
- **Push notifications** are not wired up yet. In-app notifications work everywhere; system
  push notifications would need `expo-notifications`, an APNs key, and a delivery Edge
  Function.
- **Hebrew RTL** is declared in the iOS build via `CFBundleLocalizations`, so the app is
  offered in Hebrew and English and picks up the phone's language on first launch. Switching
  language inside the app requires a restart on native, which is an iOS constraint on
  flipping layout direction.
- **Export compliance**: `ITSAppUsesNonExemptEncryption` is set to `false`, so TestFlight
  will not ask the encryption question on every upload.
