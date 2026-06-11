# ComOt — Marketing Landing Page

Static, dependency-free landing page (single `index.html` + assets). Built in the approved **Design Direction 2 — "Clean Ledger"** (indigo/white fintech aesthetic, see `../docs/DESIGN_PROPOSALS.md`).

> The header/footer mark is a placeholder based on logo Option A — it will be replaced with the final SVG once a logo is selected (see `../docs/LOGO_OPTIONS.md`).

## Features

- **Bilingual:** Hebrew (default, RTL) ⇄ English (LTR) via the `EN`/`עב` toggle in the navbar; choice persists in `localStorage`.
- **Sections:** hero with app mockup, 8 core features, the fault-to-fix scenario flow, committee configuration, building isolation, vendor marketplace, waitlist CTA.
- **Responsive:** desktop, tablet, and mobile layouts.
- No build step — deployable as-is to GitHub Pages, Vercel, or Netlify.

## Run locally

```bash
cd landing
python3 -m http.server 8080
# open http://localhost:8080
```

## Before launch

- [ ] Wire the waitlist form to a real backend (Formspree / Supabase table) — currently shows a success message only.
- [ ] Replace placeholder store badges with official App Store / Google Play badges once listings exist.
- [ ] Add analytics (e.g., Plausible) and a privacy policy page.
