# ComOt (קומות)

Residential building management platform — connecting tenants, house committees (Va'ad Bayit), and service providers in one app.

**Platforms:** iOS · Android · Web (Chrome) | **Languages:** Hebrew (RTL) · English

## Monorepo layout

```text
├── apps/
│   ├── mobile/      # Expo app (iOS / Android / Web) — Phase 1 implemented
│   └── landing/     # Marketing landing page (static, approved design)
├── packages/
│   └── shared/      # Shared domain types
├── supabase/        # Postgres schema, RLS policies, RPCs + SQL smoke tests
└── docs/            # Product spec, design decisions, tech stack
```

## Quick start

```bash
pnpm install

# Mobile / web app (see supabase/README.md to configure the backend first)
cp apps/mobile/.env.example apps/mobile/.env   # fill in Supabase keys
pnpm dev                                       # Expo dev server (press i / a / w)

# Landing page
pnpm landing                                   # http://localhost:8080

# Checks
pnpm typecheck && pnpm lint
```

## Run the whole thing locally

With Docker and the Supabase CLI installed, this brings up the backend and the app with no
cloud project involved, seeded with a populated demo building:

```bash
pnpm install
pnpm db:start                                        # Postgres, Auth, Realtime + migrations + seed
cp apps/mobile/.env.local.example apps/mobile/.env.local   # paste the anon key it printed
pnpm web                                             # http://localhost:8081
```

Sign in as `test@comot.test` / `1234`. Full walkthrough, including the other demo accounts
and service providers, in [`docs/RUN_LOCALLY.md`](docs/RUN_LOCALLY.md).

## Install it

<https://asscobara.github.io/ComotV2/download.html> works out which device you are on and
shows the right route. Both take under a minute and cost nothing:

- **Chrome or Edge**, on a desktop or on Android — open the app and accept the install
  prompt. You get an icon, a window with no browser bars, and an app that still opens when
  the network is down. On Android it is installed as a WebAPK, so it lands in the app
  drawer like any other app.
- **iPhone or iPad** — open the app in Safari, then *Share > Add to Home Screen*.

Push notifications and biometric sign-in are the only things that need a store build.
[`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) covers every route and what the App Store
and Play releases still need; [`docs/IOS_TESTING.md`](docs/IOS_TESTING.md) covers Expo Go
and signed builds while developing.

```bash
pnpm release:check    # what still stands between here and a store release
```

## Project status

| Deliverable | Where | Status |
| --- | --- | --- |
| Product specification | [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | ✅ Drafted |
| Design direction | [`docs/DESIGN_PROPOSALS.md`](docs/DESIGN_PROPOSALS.md) | ✅ Approved — Direction 2 "Clean Ledger" |
| Logo | [`docs/LOGO_OPTIONS.md`](docs/LOGO_OPTIONS.md) | ✅ Selected — Option B "C Monogram Building" |
| Marketing landing page | [`apps/landing/`](apps/landing/) | ✅ Built in approved design |
| Technology stack | [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | ✅ Approved (Expo + Supabase) |
| Installing on a device | [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md), [`docs/IOS_TESTING.md`](docs/IOS_TESTING.md) | ✅ Installable from Chrome, Edge and Safari; EAS build and submit wired |
| Backend resources & connection details | [`docs/BACKEND.md`](docs/BACKEND.md) | ✅ Documented |
| Running locally (no cloud project) | [`docs/RUN_LOCALLY.md`](docs/RUN_LOCALLY.md) | ✅ Stack config + seed data |
| App Store submission | [`docs/APP_STORE.md`](docs/APP_STORE.md) | ✅ Build, submit and listing prepared; needs an Apple account |
| Google Play submission | [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) | ✅ Build and submit wired; needs a Play account |
| Google Cloud backend | [`docs/GCP_MIGRATION.md`](docs/GCP_MIGRATION.md), [`deploy/gcp/`](deploy/gcp/) | ⏳ Terraform + SQL written and verified; needs a GCP project to apply |
| **Phase 1 — Foundations** | [`apps/mobile/`](apps/mobile/), [`supabase/`](supabase/) | ✅ Implemented |
| Phase 2 — Chat, events, polls, faults | — | ⏳ Next |
| Phase 3 — Budget, vendors, matching | — | Planned |

### Phase 1 scope (implemented)

- **Auth:** email/password + social sign-in (Google / Apple / Facebook) via Supabase Auth
- **Building setup:** committee creates the building; apartments auto-generated; invite code issued
- **Tenant self-registration:** join by invite code, pick apartment + owner/renter, pending until committee approval
- **Tenant management:** approve / reject / edit / remove tenants
- **Committee handover:** outgoing member nominates a successor; the role transfers only after explicit in-app confirmation
- **Multi-tenancy:** Postgres Row-Level Security — every building is a closed ecosystem (covered by SQL smoke tests in CI)
- **i18n:** Hebrew (RTL, default) + English

## Core features (full product)

1. **Tenant management** — owners & renters, social sign-up with committee approval ✅
2. **Internal chat** — building channels + private messages
3. **Event management** — routine (monthly Va'ad fees) and ad-hoc (faults, meetings)
4. **Committee meetings** — virtual meeting room with live polls
5. **Budget management** — fee collection, recurring & one-time expenses, deficit alerts
6. **Vendor management** — marketplace + automatic matching by expertise, location, budget
7. **Notifications** — fee reminders, deficit alerts, fault status updates
8. **Reports** — expenses, income, available service providers
