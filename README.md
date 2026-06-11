# ComOt (קומות)

Residential building management platform — connecting tenants, house committees (Va'ad Bayit), and service providers in one app.

**Platforms:** iOS · Android · Web (Chrome) | **Languages:** Hebrew (RTL) · English

## Project status — Phase 0

| Deliverable | Where | Status |
| --- | --- | --- |
| Product specification | [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | ✅ Drafted |
| Design direction | [`docs/DESIGN_PROPOSALS.md`](docs/DESIGN_PROPOSALS.md) | ✅ Approved — Direction 2 "Clean Ledger" |
| Logo options (4 concepts) | [`docs/LOGO_OPTIONS.md`](docs/LOGO_OPTIONS.md) | ⏳ Awaiting selection |
| Marketing landing page | [`landing/`](landing/) | ⏳ Built in approved design, awaiting approval |
| Technology stack selection | [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | ✅ Proposed |
| Repository plan | [`docs/REPOSITORIES.md`](docs/REPOSITORIES.md) | ✅ Proposed (monorepo) |

## Core features (planned)

1. **Tenant management** — owners & renters, social sign-up with committee approval
2. **Internal chat** — building channels + private messages
3. **Event management** — routine (monthly Va'ad fees) and ad-hoc (faults, meetings)
4. **Committee meetings** — virtual meeting room with live polls
5. **Budget management** — fee collection, recurring & one-time expenses, deficit alerts
6. **Vendor management** — marketplace + automatic matching by expertise, location, budget
7. **Notifications** — fee reminders, deficit alerts, fault status updates
8. **Reports** — expenses, income, available service providers

Every building is a **fully isolated account** — multi-tenancy is enforced at the database layer.

## Quick look — landing page

```bash
cd landing && python3 -m http.server 8080
# open http://localhost:8080  (Hebrew by default, EN toggle in the navbar)
```
