# ComOt — GitHub Repository Plan

## Recommendation: one monorepo (this repository, `ComotV2`)

For a small team building a cross-platform app with shared TypeScript types between the client and backend functions, a **single monorepo is the right call**. Multiple repos at this stage add release coordination, duplicated CI, and version-skew pain with zero benefit.

### Target monorepo layout

```text
ComotV2/
├── apps/
│   ├── mobile/           # Expo app (iOS / Android / Web) — the product
│   └── landing/          # Marketing landing page (static, exists today at /landing)
├── packages/
│   ├── shared/           # Domain types, validation schemas (zod), i18n resources
│   └── ui/               # Design system: tokens + cross-platform components
├── supabase/
│   ├── migrations/       # SQL migrations incl. RLS policies
│   └── functions/        # Edge Functions (matching, notifications, reports, handover)
├── docs/                 # Specs and decisions (this folder)
└── .github/workflows/    # CI: typecheck, lint, test, EAS build, deploys
```

Tooling: **pnpm workspaces + Turborepo**, single `tsconfig` base, shared ESLint/Prettier.

### When to split into separate repositories

Split only when a real trigger appears:

| Trigger | New repo |
| --- | --- |
| Landing page handed to a marketing team/agency | `comot-landing` |
| Dedicated backend service outgrows Edge Functions (phase 3+) | `comot-api` |
| Public artifacts (SDK, vendor integration API) | `comot-sdk` |

## Note on creating repositories

This agent's GitHub access is **read-only for repository administration** — it cannot create new repositories under your username. Two options:

1. **(Recommended)** Keep everything in `ComotV2` per the monorepo plan above — no new repos needed; this PR already starts that structure (`docs/`, `landing/`).
2. If you want separate repos anyway, create them in GitHub (e.g., `comot-app`, `comot-landing`) and an agent can populate them once they exist and access is granted.
