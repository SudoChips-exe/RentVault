# RentVault — Full Frontend Redesign Prompt (Tenant App + Admin/Landlord Dashboards)

You are the design lead on RentVault, a rent escrow anti-fraud platform for the Nigerian rental market, built for a hackathon demo. The landing page has already been redesigned and is locked — do not touch it. Your job is to bring every other screen up to the same bar: tenant-facing flows in the React/Vite app, and the Next.js landlord + admin dashboards. This needs to look like a funded fintech product, not an AI-generated hackathon template, because it's being judged on demo quality.

## Non-negotiable design tokens (read directly off the actual redesigned `HomePage.tsx`, `tailwind.config.js`, and `index.css` — do not change these)

- **Brand accent (primary):** emerald scale, `brand.500 = #22c55e` (full 50–900 scale defined in Tailwind config — use the scale, not just the single hex).
- **Secondary accent:** Nomba yellow, `nomba.500 = #FFC105` (full 50–900 scale also defined). Used sparingly — eyebrow pills, numbered markers in dark sections, small icon accents. This is a real secondary brand color from the actual design, not something to invent.
- **Deep background:** `slate-950 = #020617` for dark sections. Standard Tailwind slate scale for everything else (slate-50 through slate-900).
- **The landing page is NOT all-dark.** It alternates light (`bg-white`, slate-900 text) and dark (`bg-slate-950`, white text) full-bleed sections as you scroll, and a `HeaderThemeContext` (`useHeaderTheme`) flips the navbar's theme via an `IntersectionObserver` watching each section's `data-theme="light"|"dark"` attribute. Match this pattern in any new full-page screens — don't default to dark-only.
- **Display/body font:** Inter, with very heavy weights and tight tracking on headlines — `font-black tracking-tighter` (or `tracking-tight`) at large sizes (`text-6xl` to `text-7xl`+ on hero headlines). This aggressive big-bold-tight headline treatment is the actual brand signature — preserve it on any screen with a true hero/primary heading; don't water it down to safe dashboard-scale type.
- **Financial data font:** `"IBM Plex Mono"` (already imported in `index.css`, already wired into Tailwind's `mono` family) — used in the real build for transaction IDs (`RV-0847`), percentages, and numbered step markers (`01`, `02`, `03`). Keep using it for all money, IDs, percentages, and timestamps. Body copy and labels stay in Inter.
- **Card system:** generously rounded cards — `rounded-3xl`/`rounded-2xl`, soft large shadows (`shadow-2xl shadow-slate-200/50` on light cards), thin 1px borders (`border-slate-200` on light, `border-slate-800` on dark), with blurred color-wash glows behind hero elements (`blur-2xl`/`blur-3xl` brand/nomba gradients at low opacity) for depth — not flat panels.
- **Dark-panel utilities already exist in `index.css`:** `.glass-panel` (translucent slate + backdrop-blur, subtle white border) and `.glass-panel-hover` (lift + emerald glow on hover). Reuse these for any dark-themed cards in the dashboards rather than inventing new glass treatments.
- **Icon set:** `lucide-react` — stay in this library for consistency with the landing page (`ArrowRight`, `CheckCircle2`, `ShieldCheck`, `Zap`, `Scale`, `Eye`, `HelpCircle`, etc.).

## What "good" looks like here

Read this as a working design brief, not a checklist:

1. **Reuse the landing page's actual signature element — don't invent a new one.** `HomePage.tsx` already contains a working component called `EscrowLedger`: a white, `rounded-3xl`, heavily-shadowed card with a macOS-style traffic-light header bar, a vault ID in mono (`Secure Vault · RV-0847`), a live-cycling status (`FUNDS HELD → DOCS SUBMITTED → VERIFIED → DISBURSED`) with a progress bar and animated dot, and a disbursement breakdown list that fills in once disbursed. This is the real signature motif. Extract its visual language — the card chrome, the status-dot-plus-progress-bar pattern, the pending-vs-resolved row treatment (dashed border + ghost text for pending, solid + checkmark for resolved) — and reuse it as the basis for: the transaction status page's main state display, the admin verification queue's per-item status, and any listing/transaction summary card. Don't build a competing visual language for "transaction state" elsewhere in the product.
2. **Structure should encode real information.** If you use numbered steps, dividers, or status labels, they should reflect something genuinely sequential or stateful (the actual escrow lifecycle, a real verification queue order) — not decorative 01/02/03 markers slapped on arbitrary content.
3. **Dashboards are not an excuse to default to generic admin-template patterns** (sidebar + stat cards + data table, all default Tailwind grays). They share the RentVault brand and should feel like the operations console of the same product the tenant sees, just denser and faster to scan. Use the slate/emerald palette and mono-for-numbers convention to keep it cohesive, not a separate "admin theme."
4. **Motion with restraint.** Where it helps (a transaction status changing state, a verification being approved, a disbursement completing), use a deliberate, purposeful transition. Don't scatter hover effects everywhere; avoid anything that reads as default AI-generated micro-animation.
5. **Copy matters.** Write from the end user's side: a tenant should see what's happening to *their money*, not system internals. A landlord/admin should see actionable status, not vague labels. Empty states and errors should say what happened and what to do next, in plain language — no apologetic filler, no raw error codes shown to tenants.
6. Hit a professional quality floor: fully responsive down to mobile, visible keyboard focus states, no layout shift, reduced-motion respected for anyone with that OS preference on.

## Current state of each file (checked directly against the repo — work from this, not assumptions)

**Already redesigned — reference these, don't redo them:**
- `frontend/src/components/HomePage.tsx` — the landing page (locked, do not touch)
- `frontend/src/components/Navbar.tsx` — already matches the new light/dark alternating theme via `useHeaderTheme`, already clean (no debug logs). Use it as the reference for how nav/header should feel everywhere else, but don't redo it.

## Current state of each file (UPDATED)

**Redesigned and Verified ✅:**
- `frontend/src/components/HomePage.tsx` — the landing page (locked)
- `frontend/src/components/Navbar.tsx` — reference for theme
- `frontend/src/components/ListingSearch.tsx` — redesigned with alternating light/dark sections and refined cards.
- `frontend/src/components/ListingDetail.tsx` — redesigned with high-contrast light theme and refined layout.
- `frontend/src/components/TransactionStatus.tsx` — redesigned using the EscrowLedger motif for a professional fintech feel.
- `frontend/src/components/SignInModal.tsx` — redesigned for "funded fintech" grade and fixed localhost redirect bug.

**Dashboards (`dashboards/app/`, Next.js 14) — Redesigned ✅:**
- `globals.css` — set up brand theme (Emerald/Nomba) and fonts (Inter/IBM Plex Mono) using Tailwind v4 `@theme`.
- `app/page.tsx` — redesigned for a polished entry experience.
- `app/admin/page.tsx` — redesigned with high-density, white-themed tables.
- `app/admin/verification/page.tsx` — redesigned for efficient review workflow.
- `app/admin/refunds/page.tsx` — redesigned with a clean, professional queue.
- `app/admin/split-configs/page.tsx` — redesigned for intuitive config management.
- `app/admin/audit/page.tsx` — redesigned with a clean, read-only audit trail.
- `app/landlord/page.tsx` — redesigned overview with professional stat cards.
- `app/landlord/listings/page.tsx` — redesigned listing management.
- `app/landlord/verification/page.tsx` — redesigned upload flow.
- `app/landlord/disbursements/page.tsx` — redesigned payout history.
- `app/landlord/settings/page.tsx` — redesigned settings interface.
- `app/components/DashboardLayout.tsx` — redesigned sidebar and top bar for a cohesive brand experience.

## Real bugs to fix while you're in these files

1. **`SignInModal.tsx`** — `handleLandlordSignIn` still hardcodes `window.location.href = 'http://localhost:3000'` for the landlord-dashboard redirect. Replace with a value read from an environment variable so it doesn't break outside local dev. (This is the only bug from the prior audit that's still actually present — Navbar's debug `console.log`s and TransactionStatus's disbursements-subcollection bug are both already fixed in the current code, no need to touch them again.)
2. While redesigning each dashboard page, watch for the same class of issue (hardcoded URLs, dead Cloud Function names, leftover debug logging) and flag/fix anything found — but don't assume bugs exist where the code is already correct.

## Process

1. Before writing any code, state a short design plan: confirm the signature motif for this batch of screens, the type scale for dashboard contexts (how the "big Inter headline" energy scales down sensibly for denser admin views without losing brand identity), and how IBM Plex Mono is applied consistently across every money/ID/timestamp instance.
2. Then go file by file in the order listed above. For each file, briefly note what was structurally wrong with the previous version (generic layout, weak hierarchy, inconsistent data typography, etc.) before showing the rebuilt version.
3. Keep all existing data wiring, Firebase calls, and Cloud Function invocations intact — this is a visual/UX and bug-fix pass, not a backend rewrite. If a fix requires touching a function signature or Firestore read pattern (as with the `SignInModal.tsx` env-variable fix above), make the minimal correct change and explain it.
4. Confirm at the end that the landing page was not modified, and that the signature transaction-state motif appears consistently across the tenant flow and the admin verification queue.