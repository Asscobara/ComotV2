# ComOt — Technology Stack Selection

Goals driving the selection: **one codebase for iOS + Android + Chrome**, **hard multi-tenant isolation**, **Hebrew/English with RTL**, **realtime chat**, **social login with approval flow**, **push notifications**, and a clean **scaling path** without over-building for day one.

---

## Recommended Stack (summary)

| Layer | Choice | Why |
| --- | --- | --- |
| App (iOS/Android/Web) | **React Native + Expo (TypeScript), Expo Router** | One codebase for all three required platforms; OTA updates via EAS Update; mature RTL support; web output runs in Chrome. |
| UI | **Custom design system on top of React Native primitives** + `react-native-reanimated` | Tokens come straight from the approved design direction; full RTL control. |
| i18n | **i18next + react-i18next** (`he` default, `en`) + `I18nManager` for RTL | Industry standard; lazy-loaded locale bundles; handles plurals/dates/currency (₪). |
| Backend platform | **Supabase** (managed PostgreSQL, Auth, Realtime, Storage, Edge Functions) | One platform covers 5 hard requirements out of the box — see below. |
| Database | **PostgreSQL with Row-Level Security (RLS)** | `building_id` on every tenant-scoped table; isolation enforced *in the database*, not just app code. |
| Auth | **Supabase Auth** — Google / Apple / Facebook + email | Social registration requirement; approval flow modeled as `membership.status = pending` gated by RLS. |
| Chat / realtime | **Supabase Realtime channels** (Postgres-backed messages) | Building channels + DMs with RLS isolation; no separate chat infrastructure to operate. |
| Push notifications | **Expo Notifications** (wraps FCM + APNs) | Single API for both stores; scheduled fee reminders via Supabase cron + Edge Functions. |
| Business logic | **Supabase Edge Functions (TypeScript/Deno)** | Vendor matching, deficit detection, special-collection creation, handover confirmation, report generation. |
| Reports/exports | Edge Function rendering to **PDF (pdf-lib) / CSV**, stored in Supabase Storage | Localized exports per `docs/PRODUCT_SPEC.md` §2.8. |
| Payments (phase 3) | **Stripe** for vendor subscriptions; Israeli PSP (Meshulam / Tranzila / Grow) for Va'ad fee collection | Stripe doesn't fully cover Israeli consumer collection use cases; decide at phase 3. |
| Landing page | **Static HTML/CSS/JS** (no build step), deployable to GitHub Pages / Vercel | Already implemented in `landing/`. |
| Monorepo tooling | **pnpm workspaces + Turborepo** | Shared types/UI between app and edge functions. |
| CI/CD | **GitHub Actions + EAS Build/Submit** | Lint/test/typecheck per PR; store builds and web deploys from `main`. |
| Observability | **Sentry** (app + functions) | Crash and error reporting from day one. |

---

## Why Expo (React Native) over the alternatives

| Option | Verdict |
| --- | --- |
| **Expo / React Native** ✅ | iOS + Android + Web from one TypeScript codebase. First-class RTL (`I18nManager`), huge ecosystem, EAS handles store builds and OTA updates. Web output is good for the Chrome requirement (tenant portal + committee dashboard). |
| Flutter | Excellent mobile quality, but web output (canvas renderer) is heavier, worse for SEO/accessibility, and Dart narrows the contributor pool vs TypeScript shared with the backend. |
| Native (Swift + Kotlin) + separate web app | 3 codebases; triple the work for every feature. Rejected for cost/speed. |
| PWA only | No reliable iOS push until recently, weaker store presence. Rejected. |

## Why Supabase over the alternatives

| Option | Verdict |
| --- | --- |
| **Supabase** ✅ | Postgres + **RLS gives true database-level multi-tenancy** (the closed-ecosystem requirement). Auth with the exact social providers needed. Realtime channels cover chat. Storage covers fault photos. Edge Functions + pg_cron cover scheduled fee reminders. Self-hostable later — no hard lock-in. |
| Firebase | Great realtime, but Firestore security rules are harder to audit for strict isolation, no SQL for budget reporting/aggregations, and queries for reports get awkward. |
| Custom NestJS + Postgres + Redis | Maximum control, but we'd build auth, realtime, storage, and cron ourselves before writing any product feature. This remains the **phase-3+ escape hatch**: because data is plain Postgres, we can put a NestJS API in front of the same database when custom logic outgrows Edge Functions. |

## Multi-tenancy model (the core constraint)

```text
buildings(id, name, address, floors, apartments_count, settings_jsonb, ...)
memberships(user_id, building_id, role[committee|tenant], tenant_type[owner|renter],
            status[pending|active|removed], apartment_id, ...)
-- Every building-scoped table (messages, events, faults, budget_entries, polls, ...)
-- carries building_id. RLS policy template:
CREATE POLICY building_isolation ON <table>
  USING (building_id IN (
    SELECT building_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'));
```

- Tenants in `pending` status see nothing until the committee approves them.
- **Vendors are global** (cross-building marketplace) but jobs/bookings are building-scoped; vendors see only jobs offered to them.
- A future "many buildings per management company" feature is just additional memberships — the model already supports it.

## Scalability path

1. **Now:** Supabase Pro (managed Postgres + read replicas), stateless Edge Functions, CDN for landing/static assets.
2. **Growth:** connection pooling (pgBouncer, built-in), partition hot tables (`messages`, `notifications`) by `building_id` hash, move notification fan-out to a queue (Supabase Queues / SQS).
3. **Scale-out:** front the same Postgres with a dedicated NestJS API for complex domains (matching, billing), or migrate Supabase self-hosted/RDS. No data migration cliff because everything is standard Postgres.

## Localization

- `i18next` with `he` (default, RTL) and `en`; all strings in locale files from day one — no hardcoded copy.
- RTL-aware styles via logical properties (`start`/`end`, not `left`/`right`).
- Localized dates (`Intl`), currency (₪), and notification templates stored per-locale.

## Repository & code layout

See `REPOSITORIES.md`.
