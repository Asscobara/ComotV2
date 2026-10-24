# ComOt — Marketing Landing Page

Static, dependency-free landing page (single `index.html` + assets). Built in the approved **Design Direction 2 — "Clean Ledger"** (indigo/white fintech aesthetic, see `../../docs/DESIGN_PROPOSALS.md`).

> The header, footer, and favicon use the selected logo — **Option B "C Monogram Building"** (working vector at `../../docs/design/logos/comot-mark.svg`; see `../../docs/LOGO_OPTIONS.md`).

## Features

- **Bilingual:** Hebrew (default, RTL) ⇄ English (LTR) via the `EN`/`עב` toggle in the navbar; choice persists in `localStorage` under the same key the app uses.
- **Sections:** hero with app mockup, 8 core features, the fault-to-fix scenario flow, committee configuration, building isolation, vendor marketplace, waitlist CTA.
- **`download.html`:** the install page every store badge points at. Detects the visitor's device and highlights the matching route. The App Store, TestFlight and Google Play buttons are driven by `STORE_LINKS` at the bottom of that file — fill a URL in and the badge goes live, leave it empty and it stays a "coming soon" placeholder.
- **Responsive:** desktop, tablet, and mobile layouts.
- No build step — deployable as-is to GitHub Pages, Vercel, or Netlify.

## Run locally

```bash
cd apps/landing
python3 -m http.server 8080
# open http://localhost:8080
```

## Before launch

- [ ] Wire the waitlist form to a real backend (Formspree / Supabase table) — currently shows a success message only.
- [ ] Fill `STORE_LINKS` in `download.html` and swap in the official App Store / Google Play badge artwork once the listings exist.
- [ ] Replace the placeholder `support@comot.app` address in `support.html` and `privacy.html` with a mailbox someone reads — App Review opens both pages.
- [ ] Add analytics (e.g., Plausible).
