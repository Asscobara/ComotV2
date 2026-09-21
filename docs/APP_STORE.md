# Submitting ComOt to the App Store

Everything in this repository that submission depends on is in place. What remains needs an
Apple account, so it has to be done by the account holder.

Read [`IOS_TESTING.md`](IOS_TESTING.md) first if you have not produced a build yet; this
document picks up from there and covers review and the store listing.

## What you have to do

| Step | Why it can't be automated |
| --- | --- |
| Enrol in the **Apple Developer Program** ($99/yr) | Apple verifies your identity; approval is not instant |
| Create the app in **App Store Connect** | Requires your Apple ID |
| Create an **Expo account** and add `EXPO_TOKEN` to repository secrets | Ties builds to your account |
| Run `eas init` once and commit the result | Writes `extra.eas.projectId` and `owner` into `app.json` |
| Sign in to Apple when EAS asks, and let it manage credentials | Apple credentials are yours |
| Fill the store listing and submit | Legal declarations are made by the account holder |

## Before you submit: the backend must be live

This is the most likely cause of rejection for this app, and it has nothing to do with the
code. ComOt is useless without its backend: the reviewer signs in, and if Supabase is
unreachable they see "can't reach the server" and reject under guideline 2.1 as a
non-functional app.

The project at `mkylsnmdxiwgylsezmdu.supabase.co` currently does not resolve, so **as of
today a submission would be rejected**. Restore it before submitting — see
[`../supabase/README.md`](../supabase/README.md) — and remember free projects pause after a
week of inactivity, which can happen *during* review.

For a submitted app, a paid Supabase plan is worth it purely because it does not pause.

## Two things to fix in the app first

**1. Social sign-in buttons must work or come out.** The sign-in screen offers Google, Apple
and Facebook. A button that fails is "broken functionality" under guideline 2.1, and a
reviewer will try all three. Either configure all three providers under *Authentication →
Providers* in Supabase, with `comot://` in the redirect allow-list, or remove the ones you
are not configuring.

Note that Apple's guideline 4.8 means that if you offer Google or Facebook sign-in you must
also offer Sign in with Apple. Keeping Apple and dropping the other two is a valid way to
reduce the work; dropping Apple while keeping the others is not.

**2. Replace the placeholder support address.** `support@comot.app` appears in
`apps/landing/privacy.html` and `apps/landing/support.html` and in the listing below. App
Review opens both pages. Point it at a mailbox you actually read.

## What is already handled

- **Account deletion**, required by guideline 5.1.1(v) for any app with account creation.
  In-app under *More → My account*, with a preview of what will be lost and a confirmation.
  A building is never left with residents but no committee: deletion is refused until the
  role is handed over, and a building whose last member leaves is removed with them.
- **Privacy policy** at `/ComotV2/privacy.html` and **support page** at
  `/ComotV2/support.html`, both deployed from `apps/landing/` and linked in the site footer.
- **Export compliance** — `ITSAppUsesNonExemptEncryption` is `false`, so TestFlight and App
  Store Connect stop asking on every upload.
- **Localizations** — `CFBundleLocalizations` declares Hebrew and English, so the app is
  offered in both and picks up the device language.
- **iPad is switched off** (`supportsTablet: false`). The layout has never been tested on
  iPad, and shipping an untested layout invites a rejection for not working as expected.
  Turning it on later means testing the layout and supplying iPad screenshots.
- **Build numbers** are managed by EAS (`appVersionSource: "remote"`), so uploads cannot
  collide on a used build number.

## Submitting

```bash
cd apps/mobile
pnpm dlx eas-cli@latest build --platform ios --profile production --auto-submit
```

Or run the **Mobile Build (EAS)** workflow from the Actions tab with profile `production`
and submit enabled. Either way EAS builds on its own Macs, uploads to App Store Connect, and
the build appears for TestFlight after processing.

Test it through TestFlight yourself before submitting for review. Then in App Store Connect
attach the build to a version, fill in the listing below, and submit.

## Store listing

Ready to paste. Keep both languages, with Hebrew as the primary.

**Category:** Lifestyle (secondary: Productivity)
**Age rating:** 4+ — no objectionable content. Answer "none" to every content question.
**Price:** Free
**Privacy policy URL:** `https://asscobara.github.io/ComotV2/privacy.html`
**Support URL:** `https://asscobara.github.io/ComotV2/support.html`
**Marketing URL:** `https://asscobara.github.io/ComotV2/`

### Hebrew

**Name:** ComOt — ניהול בניין
**Subtitle:** ועד בית, דיירים ותשלומים במקום אחד

**Keywords:** ועד בית,ניהול בניין,דיירים,דמי ועד,תקלות,אסיפת דיירים,סקרים,בית משותף,נציגות,מעלית

**Description:**

```
ComOt מרכזת את כל ניהול הבניין במקום אחד — לוועד הבית, לדיירים ולנותני השירות.

דיירים
רשימת דיירים מעודכנת, הצטרפות בקוד הזמנה ואישור של הוועד. כל בניין הוא סביבה סגורה: דיירים רואים רק את הבניין שלהם.

צ'אט
ערוץ לכל הבניין והודעות פרטיות בין דיירים, בלי קבוצות וואטסאפ שנשכחות.

תקלות
דיווח תקלה עם תיאור ומקום, מעקב אחר הטיפול מ„דווח" ועד „טופל", והיסטוריה מלאה.

אסיפות וסקרים
תיאום אסיפות דיירים, חדר דיון לכל אסיפה וסקרים — כולל סקרים אנונימיים שבהם הבחירה האישית אינה נחשפת.

תקציב ותשלומים
מעקב הכנסות והוצאות, גביית דמי ועד לפי דירה ותקופה, ומסך תשלומים אישי שמראה מה שולם ומה טרם שולם.

נותני שירות
מדריך בעלי מקצוע לפי תחום ועיר, התאמה אוטומטית לתקלה והזמנת עבודה ישירות מהאפליקציה.

עברית מלאה עם תמיכה ב-RTL, וגם אנגלית.

ComOt אינה מעבדת תשלומים ואינה אוספת פרטי כרטיס אשראי — היא רושמת מה שולם.
```

### English

**Name:** ComOt — Building Management
**Subtitle:** House committee, tenants and fees

**Keywords:** house committee,building management,tenants,hoa,building fees,maintenance,faults,residents,meetings,polls

**Description:**

```
ComOt brings running a residential building into one place — for the house committee, the residents and the service providers.

Tenants
An up-to-date resident list, joining by invite code, and committee approval. Every building is a closed environment: residents only ever see their own.

Chat
A building-wide channel and private messages between residents, instead of a forgotten group chat.

Faults
Report a fault with a description and location, follow it from reported to resolved, and keep the full history.

Meetings and polls
Schedule residents' meetings, get a discussion room for each one, and run polls — including anonymous polls where individual choices are never exposed.

Budget and payments
Track income and expenses, collect committee fees by apartment and period, and give each resident a personal payments screen showing what is paid and what is outstanding.

Service providers
A directory of professionals by trade and city, automatic matching to a fault, and booking a job from inside the app.

Full Hebrew with right-to-left support, and English.

ComOt does not process payments and never collects card details — it records what has been paid.
```

## App Privacy answers

App Store Connect asks what the app collects. Declare these, all as **used for app
functionality**, all **linked to the user**, and none **used for tracking**:

| Data type | Why |
| --- | --- |
| Contact Info → Email Address | Sign-in and identifying you to other residents |
| Contact Info → Name | Shown to other residents in the building |
| Contact Info → Phone Number | Optional on the profile; providers publish one |
| User Content → Other User Content | Chat messages, fault reports, notes, poll votes |
| Identifiers → User ID | The account identifier every row is keyed by |
| Financial Info → Other Financial Info | Fee amounts owed and recorded as paid, per apartment |

Answer **no** to tracking, advertising, analytics, location, contacts, photos, health and
diagnostics — none are collected. There is no third-party SDK doing any of it.

The financial entry is worth declaring even though no card details are involved: the app
does store amounts a resident owes and has paid. Under-declaring is the riskier mistake.

## Review notes

Put this in *App Review Information → Notes*, with a demo account that works on the
production backend:

```
ComOt is a building management app. All content is behind sign-in because a building's
data is private to its residents.

Demo account (house committee, full access):
  email: <a real account on the production project>
  password: <its password>

This account is a committee member of a populated demo building, so every screen has data:
tenants with one pending approval, chat, faults, a meeting with a live poll, budget, fees
and service providers.

The interface defaults to Hebrew (right-to-left). To switch to English: More > Language.

Account deletion is in the app under More > My account > Delete my account.

ComOt does not process payments. It records which committee fees have been paid, as marked
by the house committee, and never collects card or bank details.
```

Create that demo account on the production project rather than reusing the local seed, and
keep it alive — a reviewer who cannot sign in will reject.

## Screenshots

Apple needs at least one iPhone size. Eight screenshots at 1290 × 2796 (an accepted iPhone
size) were generated from the running app with real data, covering home, tenants, faults,
events, budget, payments, chat and reports.

They were captured from the web build rendered at iPhone dimensions. That is fine for a
first submission because the layout is shared, but screenshots must not misrepresent the
app: once you have a TestFlight build, retake them on a real device so the status bar and
safe areas are genuine.

## Likely rejection reasons, in order

1. **Backend unreachable** — reviewer cannot sign in. Guideline 2.1. Restore Supabase and
   keep it from pausing.
2. **A social sign-in button that fails.** Guideline 2.1. Configure the providers or remove
   the buttons.
3. **No working demo account**, or one that lands in an empty building with nothing to see.
4. **Placeholder support email** on pages the reviewer opens.
5. **Missing account deletion** — already implemented, but do not remove it.
