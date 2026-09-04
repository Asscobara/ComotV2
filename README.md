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

## Run it on your phone

The fastest way to try ComOt on an iPhone takes about two minutes and costs nothing: open
<https://asscobara.github.io/ComotV2/app/> in Safari, then *Share > Add to Home Screen*. It
installs as a standalone app against the live backend.

For Expo Go and for real signed builds via TestFlight, see
[`docs/IOS_TESTING.md`](docs/IOS_TESTING.md).

## Project status

| Deliverable | Where | Status |
| --- | --- | --- |
| Product specification | [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | ✅ Drafted |
| Design direction | [`docs/DESIGN_PROPOSALS.md`](docs/DESIGN_PROPOSALS.md) | ✅ Approved — Direction 2 "Clean Ledger" |
| Logo | [`docs/LOGO_OPTIONS.md`](docs/LOGO_OPTIONS.md) | ✅ Selected — Option B "C Monogram Building" |
| Marketing landing page | [`apps/landing/`](apps/landing/) | ✅ Built in approved design |
| Technology stack | [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | ✅ Approved (Expo + Supabase) |
| Installing on a device | [`docs/IOS_TESTING.md`](docs/IOS_TESTING.md) | ✅ Home-screen install live; EAS configured |
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
