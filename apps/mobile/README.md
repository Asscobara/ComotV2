# ComOt — Mobile App (iOS · Android · Web)

Expo (React Native + TypeScript) app with Expo Router. One codebase for all three platforms.

## Phase 1 features

- Email/password + social (Google / Apple / Facebook) sign-in via Supabase Auth
- Onboarding: committee creates a building (apartments auto-generated, invite code issued); tenants join with the invite code and wait for committee approval
- Home dashboard: building card, invite code, pending-approval alerts, committee handover confirmation
- Tenant management: approve/reject pending tenants, edit apartment/type/role, remove tenants
- Committee handover: nominate a successor; role transfers only after explicit confirmation
- Hebrew (RTL, default) + English via i18next; language switch in More tab
- Chat / Events / Budget tabs are Phase 2 placeholders

## Run

```bash
# from the repo root
pnpm install

# configure backend (see ../../supabase/README.md)
cp apps/mobile/.env.example apps/mobile/.env  # then fill in your Supabase keys

pnpm --filter mobile start     # Expo dev server (press i / a / w)
pnpm --filter mobile web      # web only
```

Without a configured `.env` the app runs and shows a "Supabase not configured" banner; auth actions will fail until the backend is set up.

## Structure

```text
src/
├── app/             # expo-router routes
│   ├── (auth)/      # sign-in
│   ├── (onboarding)/# create/join building, pending approval
│   ├── (tabs)/      # home, chat*, events*, budget*, more   (*Phase 2)
│   └── tenants/     # tenant list + editor (committee)
├── components/      # ui kit (Clean Ledger design tokens), logo
├── lib/             # supabase client, auth context, api, i18n
├── locales/         # he.json (default), en.json
└── theme.ts         # approved design tokens
```
