## Context
 
This is a hackathon project (Nomba Integrations & Plugins track) — a rent escrow system built on Firebase (Cloud Functions, Firestore, Storage, Auth) with two frontends: a React/Vite public tenant site and a Next.js dashboard app (landlord + admin views). The backend payment logic (Checkout, Webhooks, Transfers/Disbursement, Refunds, Verification) is already built and is solid. However, an audit of the codebase found 3 confirmed bugs and 3 missing features that will block a live demo. All of the following have been fixed/implemented.

---

## PRIORITY 1 — Bug Fixes (✅ ALL FIXED)

### Bug 1: Verification submit calls the wrong Cloud Function name ✅
**File:** `dashboards/app/landlord/verification/page.tsx`
**Fix applied:** Changed `'landlordSubmitVerification'` to `'verificationSubmit'`.

### Bug 2: Admin verification review calls a function that doesn't exist ✅
**File:** `dashboards/app/admin/verification/page.tsx`
**Fix applied:** Split single `adminReviewVerification` call into `verificationApprove` (with `{ transactionId }`) and `verificationReject` (with `{ transactionId }`) based on the `approved` boolean.

### Bug 3: Manual refund calls a function that doesn't exist ✅
**File:** `dashboards/app/admin/refunds/page.tsx`
**Fix applied:** Changed `'adminProcessRefund'` to `'manualRefund'`.

---

## PRIORITY 2 — Missing Features (✅ ALL IMPLEMENTED)

### Feature 1: Split Config creation (admin) ✅
**Build:** New page at `dashboards/app/admin/split-configs/page.tsx`:
- Lists existing split configs from Firestore with real-time updates
- Form to create new config: name, landlord/agent/platform percentages with client-side validation (must sum to 100)
- Writes directly to Firestore via client SDK
- Nav link added to admin sidebar in `DashboardLayout.tsx` (`/admin/split-configs`)

### Feature 2: Listing creation (landlord) ✅
**Build:** New page at `dashboards/app/landlord/listings/page.tsx`:
- Lists landlord's listings with real-time updates
- "Create Listing" form: property name, address, monthly rent (stored in kobo), optional agent UID, split config dropdown
- Writes to Firestore via client SDK
- Nav link added to landlord sidebar in `DashboardLayout.tsx` (`/landlord/listings`)

### Feature 3: Nomba account ID settings (landlord/agent) ✅
**Build:**
1. Added `updateNombaAccount(accountId: string)` to `dashboards/app/context/AuthContext.tsx` (mirrors implementation in `frontend/src/contexts/AuthContext.tsx`)
2. New page at `dashboards/app/landlord/settings/page.tsx` with input field for Nomba Account ID and save button
3. Nav link added to landlord sidebar in `DashboardLayout.tsx` (`/landlord/settings`)

---

## PRIORITY 3 — Cleanup

### Remove dead/leftover code ✅
`backend/functions/src/authRoutes.ts` has been **deleted**. It was an unrelated pharmacy-domain file not exported from `index.ts`.

### Verify environment configuration before demo 🔴 MANUAL STEP
In `backend/functions/.env`:
- `NOMBA_WEBHOOK_SECRET` is still the placeholder value. **Replace with real webhook secret from Nomba dashboard.**
- `PLATFORM_NOMBA_ACCOUNT_ID` is still the placeholder value. **Set to a real Nomba account ID.**
- `NOMBA_LIVE_CLIENT_ID`/`NOMBA_LIVE_PRIVATE_KEY` — consider switching `NOMBA_ENV` to `test` and using sandbox credentials.

---

## After completing the above

Run through this smoke test end-to-end **after deploying backend**:
1. Sign in as a landlord → go to Settings → set a Nomba account ID
2. Go to Split Configs (as admin) → create one (e.g. 80/15/5)
3. Go to Listings (as landlord) → create a listing referencing that split config
4. Sign in as a tenant → browse listings → pay rent via Nomba Checkout (test card)
5. Confirm webhook fires and transaction status becomes `funds_held`
6. As landlord → Verification Upload → submit a document (Bug 1 fix confirmed)
7. As admin → Verification Review → approve it (Bug 2 fix confirmed)
8. Confirm disbursement-trigger fires and transfers complete
9. Create a second transaction and have admin reject verification, or trigger Manual Refund (Bug 3 fix confirmed)
10. Confirm refund completes
