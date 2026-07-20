# RentVault System

A web application that enables secure rent payments with automatic escrow, landlord verification, and instant split disbursements to landlords, agents, and platforms — using **Monnify** and **Nomba** as interchangeable payment providers, chosen by the tenant at checkout. Firestore, Firebase Auth, and Firebase Storage remain the system of record; the backend API is deployed to Render as a container rather than Firebase Cloud Functions (which require the paid Blaze plan).

See [`docs/monnify/README.md`](docs/monnify/README.md) for a feature-by-feature map of the Monnify API surface this project uses, and [`pitch.md`](pitch.md) for the full product pitch.

---

## 🎯 Overview

**The Problem:** Traditional rent payments lack transparency and trust. Tenants need assurance that their payment reaches the rightful landlord, while landlords and agents need instant, automated disbursements.

**The Solution:** RentVault holds tenant payments in escrow, verifies landlord/agent credentials, and automatically splits funds to all parties—or refunds tenants if verification fails.

### Key Features

✅ **Dual Payment Providers** - Tenant chooses Monnify or Nomba at checkout; the rest of the escrow lifecycle (collection, webhook confirmation, disbursement, refund) runs identically on whichever provider collected the payment
✅ **Secure Payments** - Monnify Checkout (`init-transaction`) / Nomba Checkout, with escrow holding
✅ **Verification Flow** - Document upload and admin approval for landlord authentication
✅ **Automatic Split Transfers** - Instant disbursement to landlord, agent, and platform via Monnify Single Transfer Disbursements or Nomba Transfers
✅ **Automatic Refunds** - Timeout-based refund if verification fails, via Monnify or Nomba's Refunds API
✅ **Real-Time Updates** - Live transaction status via Firestore listeners
✅ **Audit Trail** - Complete transaction history for compliance, tagged per payment provider

---

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Express (TypeScript) - deployed as a single Docker container on Render (free tier). Replaces the original Firebase Cloud Functions backend, which requires the paid Blaze plan to deploy.
- Firestore (Database) - unchanged, still Firebase, accessed via the Admin SDK from the Express server
- Firebase Storage (Document uploads) - unchanged
- Firebase Auth (Google Sign-In) - unchanged; the Express server verifies Firebase ID tokens on each request instead of relying on Cloud Functions' built-in `context.auth`
- Monnify API (Checkout, Single Transfer Disbursements, Refunds, Transaction Verification, Webhooks) - `backend/server/src/monnify-client.ts`
- Nomba API (Checkout, Transfers, Refunds, Webhooks) - `backend/server/src/nomba-client.ts`

**Frontend:**
- React + Vite + TypeScript (Public site) - Fully redesigned with a "funded fintech" aesthetic, featuring a signature alternating light/dark theme and professional typography.
- Next.js + TypeScript (Protected dashboards) - Redesigned as a high-density operations console sharing the RentVault brand tokens.
- Tailwind CSS (Styling) - Using a shared brand palette (Emerald/Nomba) across both applications.
- Firebase SDK (Client-side integration)

**Deployment:** all three surfaces (marketing/tenant frontend, dashboards portal, backend API) are built and served from one Render Web Service - the Express server serves the Vite build as static files, embeds the Next.js dashboards app under `/dashboard`, and exposes the API under `/api`. See `Dockerfile` at the repo root. Firestore rules/indexes still deploy separately via the Firebase CLI (`firebase deploy --only firestore:rules,firestore:indexes`), which doesn't require Blaze. Document storage (verification uploads, receipts) uses Supabase Storage instead of Firebase Storage, since a Storage bucket now requires Blaze too.

### System Flow

```
┌─────────────┐
│   Tenant    │
│ (Public)    │
└──────┬──────┘
       │ 1. Search listings
       │ 2. Choose Monnify or Nomba, pay rent via that provider's Checkout
       ▼
┌───────────────────────────────────┐
│  Monnify Checkout  OR  Nomba      │
│  Checkout (Payment Gateway)       │
└──────────────┬─────────────────────┘
               │ 3. Payment confirmation webhook (provider-specific route,
               │    signature-verified: /webhooks/monnify or /webhooks/nomba)
               ▼
┌─────────────────────────┐
│  Backend API             │
│  (Express on Render,     │
│  reads/writes Firestore) │
└──────────┬──────────────┘
           │ 4. Funds held in escrow (Firestore status: funds_held,
           │    transaction.paymentProvider records which provider collected it)
           ▼
┌─────────────────────────┐
│  Landlord/Agent         │
│  (Next.js Dashboard)    │
└──────────┬──────────────┘
           │ 5. Upload verification document (Firebase Storage/Supabase)
           ▼
┌─────────────────────────┐
│  Admin Dashboard        │
│  (Next.js)              │
└──────────┬──────────────┘
           │ 6. Approve/Reject verification
           │
           ├─ ✅ APPROVED ─────────────────┐
           │                               │
           │ 7. Trigger split              ▼
           │    disbursement, on    ┌──────────────────────────────┐
           │    whichever provider  │  Monnify Single Transfer     │
           │    collected the       │  Disbursements API (or Nomba │
           │    payment             │  Transfers API) - 3 calls    │
           │                        └──────────────┬───────────────┘
           │                                       │
           │                          ┌────────────▼───────────┐
           │                          │ Landlord (80%)         │
           │                          │ Agent (15%)            │
           │                          │ Platform (5%)          │
           │                          └────────────────────────┘
           │
           └─ ❌ REJECTED OR TIMEOUT ──────────┐
                                                │
                                  ┌─────────────▼─────────────────┐
                                  │  Monnify Refunds API           │
                                  │  (or Nomba Refunds API)        │
                                  └─────────────┬───────────────────┘
                                                │
                                  ┌─────────────▼────────┐
                                  │  Tenant receives     │
                                  │  full refund         │
                                  └──────────────────────┘
```

---

## 📂 Project Structure

```
rentvault/
├── Dockerfile                   # Combined build: frontend + dashboards + backend/server
├── backend/
│   ├── server/                  # Express backend deployed to Render (replaces functions/src at runtime)
│   │   ├── src/
│   │   │   ├── index.ts                  # Entry point - mounts /api, embeds dashboards, serves frontend
│   │   │   ├── routes/
│   │   │   │   ├── checkout.ts           # POST /api/checkoutInitiate (accepts { provider: 'nomba' | 'monnify' })
│   │   │   │   ├── webhook.ts            # POST /api/webhooks/nomba
│   │   │   │   ├── webhook-monnify.ts    # POST /api/webhooks/monnify
│   │   │   │   ├── verification.ts       # POST /api/verificationSubmit|Approve|Reject
│   │   │   │   ├── tenant-verification.ts
│   │   │   │   ├── admin-api.ts          # POST /api/getAllTransactions, /api/getAuditLogs
│   │   │   │   ├── receipt.ts            # POST /api/generateReceipt
│   │   │   │   ├── reconcile.ts          # POST /api/checkPaymentStatus (provider-aware polling fallback)
│   │   │   │   └── internal.ts           # POST /api/internal/check-timeouts, /api/internal/reconcile-payments (cron-secret protected)
│   │   │   ├── disbursement.ts           # Split and transfer funds (branches on transaction.paymentProvider)
│   │   │   ├── refund.ts                 # Process refunds (branches on transaction.paymentProvider)
│   │   │   ├── payment-confirmation.ts   # Shared funds_held transition, used by both webhooks and reconciliation
│   │   │   ├── audit-logger.ts           # Log all actions
│   │   │   ├── nomba-client.ts           # Nomba API wrapper
│   │   │   ├── monnify-client.ts         # Monnify API wrapper (auth, checkout, transfer, refund, verify, webhook signature)
│   │   │   ├── models.ts                 # Firestore interfaces
│   │   │   └── middleware.ts             # Auth verification, rate limiting, error handling
│   │   └── package.json
│   ├── functions/                # Legacy Cloud Functions source - kept only for
│   │   │                          # firestore.rules/indexes, which still deploy
│   │   │                          # via the Firebase CLI (no Blaze needed)
│   │   ├── firestore.rules
│   │   └── firestore.indexes.json
│   └── .firebaserc
├── frontend/                   # React/Vite Public Site
│   ├── src/
│   │   ├── components/
│   │   │   ├── ListingSearch.tsx         # Browse listings
│   │   │   ├── ListingDetail.tsx         # View listing, choose provider, & pay rent
│   │   │   ├── CheckoutFlow.tsx          # Provider checkout redirect (Monnify or Nomba)
│   │   │   ├── TransactionStatus.tsx     # Track payment status
│   │   │   └── GoogleSignIn.tsx          # Auth button
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx           # Firebase Auth provider
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── dashboards/                 # Next.js Protected Dashboards
│   ├── app/
│   │   ├── landlord/
│   │   │   ├── page.tsx                  # Landlord dashboard
│   │   │   └── components/
│   │   │       ├── TransactionList.tsx   # View transactions
│   │   │       ├── VerificationUpload.tsx # Upload docs
│   │   │       └── DisbursementStatus.tsx # View splits
│   │   ├── admin/
│   │   │   ├── page.tsx                  # Admin dashboard
│   │   │   └── components/
│   │   │       ├── VerificationReview.tsx # Approve/reject
│   │   │       ├── RefundTrigger.tsx     # Manual refunds
│   │   │       └── AuditLog.tsx          # View logs
│   │   ├── layout.tsx
│   │   └── middleware.ts                 # Role-based access
│   ├── package.json
│   └── next.config.js
├── docs/
│   └── monnify/
│       ├── README.md                     # Monnify API feature map used by this project
│       └── monnify-api-cheat-sheet.pdf
├── pitch.md                              # Product pitch
└── README.md                             # This file
```

---

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+ and npm/bun installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Monnify API account with sandbox credentials ([dashboard](https://app.monnify.com), docs at [developers.monnify.com](https://developers.monnify.com))
- Nomba API account with sandbox credentials
- Google Cloud account (for Firebase project)

### 1. Firebase Project Setup

```bash
# Login to Firebase
firebase login

# Create new Firebase project (or use existing)
firebase projects:create rentvault

# Initialize Firebase in this directory
firebase init

# Select:
# - Firestore (database)
# - Functions (TypeScript)
# - Storage (file uploads)
# - Auth (authentication)
```

### 2. Enable Firebase Services

**In Firebase Console:**

1. **Firestore Database**: Create database in production mode
2. **Firebase Auth**: Enable Google Sign-In provider
3. **Firebase Storage**: Set up default bucket
4. **Cloud Scheduler**: Enable API (for timeout scheduler)

### 3. Configure Monnify and Nomba APIs

**Get Monnify credentials:**

1. Sign up / log in at the [Monnify Dashboard](https://app.monnify.com)
2. Switch to the **Sandbox** environment and copy your API Key and Secret Key
3. Copy your Contract Code (Settings → Merchant Contract)
4. This project currently runs on Monnify **sandbox** keys - no live/production
   Monnify credentials are used yet (see `MONNIFY_ENV=test` below)

**Get Nomba credentials:**

1. Sign up at [Nomba Dashboard](https://dashboard.nomba.com)
2. Get API keys from sandbox environment
3. Get webhook secret for signature validation

**Set backend environment variables:**

Copy `backend/functions/.env.example` to `backend/functions/.env` for local
use, and set the same variables on Render (Dashboard → your service →
Environment) for the deployed backend. Cloud Functions' legacy
`firebase functions:config:set` is no longer used - `backend/server`
reads everything from `process.env` directly (see `backend/server/src/config.ts`).

Key variables: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`
(service account, for the Admin SDK), `MONNIFY_ENV`, `MONNIFY_CONTRACT_CODE`,
`MONNIFY_TEST_API_KEY`/`MONNIFY_TEST_SECRET_KEY`, `MONNIFY_BASE_URL`,
`MONNIFY_SOURCE_ACCOUNT_NUMBER`, `NOMBA_ENV`, `NOMBA_BASE_URL`,
`NOMBA_PARENT_ACCOUNT_ID`, `NOMBA_SUB_ACCOUNT_ID`, `NOMBA_TEST_CLIENT_ID`/`NOMBA_TEST_PRIVATE_KEY`,
`NOMBA_WEBHOOK_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
and `INTERNAL_CRON_SECRET` (protects the `/api/internal/check-timeouts` and
`/api/internal/reconcile-payments` endpoints). The full list with comments is
in `backend/functions/.env.example`.

`NOMBA_WEBHOOK_SECRET` is not required to boot - reconciliation polling
(`backend/server/src/routes/reconcile.ts`, plus the cron sweep in
`internal.ts`) confirms payments without it, which matters until Nomba
dashboard access is available to actually set up the webhook. Set it once
you have it; until then the server just logs a warning and any real webhook
delivery fails signature validation harmlessly. Monnify's webhook signature
(`monnify-signature` header) is documented as production-only - it can't be
verified against sandbox test deliveries either way, so the same
reconciliation-polling fallback covers Monnify payments in sandbox.

### 4. Deploy Backend + Frontend + Dashboards (Render)

Firestore rules/indexes deploy via the Firebase CLI as before (this doesn't
require the paid Blaze plan):

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Everything else - the Express API, the Vite frontend, and the Next.js
dashboards - builds and deploys together as one Docker image on Render,
since Cloud Functions requires Blaze to deploy at all:

1. Create a Render Web Service, Docker environment, Dockerfile path `./Dockerfile` (repo root).
2. Set the environment variables listed above.
3. Deploy. Render builds the image (see the root `Dockerfile` - three build
   stages for frontend/dashboards/server, one runtime image) and gives you a
   URL like `https://rentvault-xxxx.onrender.com`.
4. Set `NOMBA_WEBHOOK_BASE_URL=https://rentvault-xxxx.onrender.com/api` on
   Render and redeploy. Despite the name, this is really just "our app's
   origin" and is reused to build Monnify's `redirectUrl` too
   (`checkout.ts`) - there's no separate `MONNIFY_WEBHOOK_BASE_URL`.
5. The verification-timeout check (originally a Firebase pubsub schedule)
   runs via the GitHub Actions workflow in `.github/workflows/timeout-check.yml`
   instead, since Render's free tier has no built-in cron - add
   `RENDER_SERVICE_URL` and `INTERNAL_CRON_SECRET` as repo secrets so it can
   call `/api/internal/check-timeouts` every 15 minutes.

### 5. Configure Monnify Webhook

1. Go to Monnify Dashboard -> Settings -> your merchant contract's webhook URL
2. Add webhook URL: `https://rentvault-xxxx.onrender.com/api/webhooks/monnify`
   (this is configured once here, not sent per-request by the API)
3. Monnify signs the raw body with `SHA-512(secretKey + rawBody)` in the
   `monnify-signature` header, using the same `MONNIFY_TEST_SECRET_KEY` /
   `MONNIFY_LIVE_SECRET_KEY` already set in step 3 - there's no separate
   webhook secret to configure.
4. Monnify delivers `SUCCESSFUL_TRANSACTION` (collection), `SUCCESSFUL_DISBURSEMENT`/
   `FAILED_DISBURSEMENT`, and `SUCCESSFUL_REFUND` events -
   `backend/server/src/routes/webhook-monnify.ts` handles these. Per Monnify's
   docs, the `monnify-signature` header is only sent in **production**, not
   sandbox - so signature validation can't be exercised against sandbox test
   deliveries; verify the payload field names against a real sandbox delivery
   before going live, and rely on reconciliation polling
   (`reconcile.ts`/`internal.ts`) as the sandbox-safe fallback in the meantime.

### 6. Configure Nomba Webhook

1. Go to Nomba Dashboard -> Developer -> Webhook Setup
2. Add webhook URL: `https://rentvault-xxxx.onrender.com/api/webhooks/nomba`
   (this is configured once here, not sent per-request by the API)
3. Set the signature key shown there as `NOMBA_WEBHOOK_SECRET`
4. Nomba delivers `payment_success`, `payout_success`, `payout_failed`, and
   `payment_reversal` events - `backend/server/src/routes/webhook.ts` handles
   these. Verify the payload shape against a real sandbox test delivery
   before going live; Nomba's public docs don't show a checkout-specific
   example, so the reference-matching fallback chain in `webhook.ts` is
   unconfirmed for that event.

### 7. Setup Frontend (Public Site)

```bash
cd frontend

# Install dependencies
npm install

# Create .env file with Firebase config
cat > .env << EOF
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
EOF

# Run development server
npm run dev

# Build for production
npm run build
```

### 8. Setup Dashboards (Next.js)

```bash
cd dashboards

# Install dependencies
npm install

# Create .env.local file with Firebase config
cat > .env.local << EOF
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
EOF

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 🧪 Testing

### Backend Testing

```bash
cd backend/server
bun test           # business logic unit tests (models, nomba-client, monnify-client, error-utils)
bun run build      # typecheck + compile the Express app
```

`backend/functions` is no longer a build target - it holds only
`firestore.rules` and `firestore.indexes.json`, deployed via the Firebase
CLI command in step 4 below. Document storage (verification uploads,
receipts) uses Supabase Storage instead of Firebase Storage, since a
Firebase Storage bucket now requires the paid Blaze plan even to stay
within its free tier. All backend logic and its tests live in
`backend/server`.

### Frontend Testing

```bash
cd frontend

# Run unit tests
npm test

# Run E2E tests
npm run test:e2e
```

### Manual Testing with Monnify and Nomba Sandboxes

**Monnify test cards** (from [developers.monnify.com/docs/test-cards](https://developers.monnify.com/docs/test-cards), CVV `123` / PIN `1234` for all):

- **Success, no OTP**: `4111 1111 1111 1111`, expires 10/2027
- **Success, with OTP**: `5060 9959 9424 7093`, expires 12/2027, OTP `123456`
- **Success, with 3DS**: `4000 0000 0000 0002`, expires 12/2027, OTP `123456`
- **Declined**: `4111 1111 1111 1110`, expires 10/2027

**Nomba test cards:**

- **Success**: `5060990580000217227` (Verve)
- **Success**: `5531886652142950` (Mastercard)
- **Declined**: `5399838383838381`

**Test Flow:**

1. Browse listings at `http://localhost:5173/listings`
2. Click into a listing, sign in with Google, choose **Monnify** or **Nomba**, then "Pay Rent"
3. Complete payment with the matching provider's test card above
4. Verify the webhook fires in the Render service logs (or local console output
   when running `backend/server` locally) - `/api/webhooks/monnify` or
   `/api/webhooks/nomba` depending on which provider was chosen. If the
   webhook doesn't fire (e.g. Monnify sandbox, which doesn't send the
   `monnify-signature` header), the transaction still confirms within ~15s via
   reconciliation polling (`POST /api/checkPaymentStatus`).
5. Upload verification document as landlord at `http://localhost:3000/landlord`
6. Approve verification as admin at `http://localhost:3000/admin`
7. Verify split transfers initiated in the same provider's dashboard
   (Monnify → Transactions → Disbursements, or Nomba dashboard)

---

## 📖 Demo Walkthrough

### For Judges

**Live Demo Script (~6 minutes):**

1. **Tenant Payment Flow** (1 min)
   - Show listing search (public, no auth required)
   - Click into a listing → Sign in with Google → choose **"Pay with Monnify"**
     (the second button switches to Nomba, showing both are live options) →
     "Pay Rent" → Monnify Checkout
   - Complete payment with a Monnify sandbox test card
   - Show payment confirmation / transaction status screen

2. **Webhook / Confirmation Processing** (1 min)
   - Open terminal with the Render service logs visible (or local console
     output when running `backend/server` locally)
   - Point out `[MONNIFY_WEBHOOK] Received SUCCESSFUL_TRANSACTION for ...`
     (or, if the sandbox didn't deliver a signed webhook, the
     `[PAYMENT] Confirmed for ... status -> funds_held` line from
     reconciliation polling instead)
   - Open Firestore console showing transaction status change to `funds_held`
     with `paymentProvider: "monnify"`

3. **Verification Flow** (1.5 min)
   - Switch to landlord dashboard
   - Show verification deadline countdown
   - Upload test PDF document
   - Switch to admin dashboard
   - Preview document and click "Approve"

4. **Split Disbursement** (1 min)
   - Show terminal logs: `[MONNIFY_TRANSFER] Landlord: ₦80,000`, `[MONNIFY_TRANSFER] Agent: ₦15,000`, `[MONNIFY_TRANSFER] Platform: ₦5,000`
   - Show Firestore console: disbursement sub-documents with `disbursed`
     status and a `monnifyTransferReference`
   - Show landlord dashboard: real-time disbursement status update

5. **Bonus: Refund Trigger** (0.5 min)
   - Reject a verification in admin dashboard
   - Show terminal logs: `[REFUND] Initiated for transaction RENT-xxx`
   - Show tenant view: refund status update

6. **Bonus: Second Provider** (0.5 min)
   - Repeat step 1 on a different listing, this time choosing **Nomba**, to
     show the exact same escrow → verification → disbursement lifecycle runs
     identically regardless of which provider collected the payment

---

## 🔒 Security

### Firebase Security Rules

**Firestore Rules:**
- Public read for `listings` collection
- Authenticated write for user-owned data
- Role-based access for admin operations

**Storage Rules:**
- Authenticated upload to `/verification-documents/{transactionId}/`
- Landlord/agent can upload, admin can read

### Webhook Signature Validation

All webhook requests validate a provider-specific signature before processing:
- **Monnify**: `SHA-512(secretKey + rawBody)`, compared via `crypto.timingSafeEqual`
  against the `monnify-signature` header (`monnify-client.ts`).
- **Nomba**: `HMAC-SHA256` over a colon-joined set of payload fields, compared
  the same way against the `nomba-signature` header (`nomba-client.ts`).

### Firebase Auth

- Google Sign-In only (no password storage)
- Firebase ID token validation on every backend API request (`backend/server/src/middleware.ts` verifies the token via the Admin SDK on each call, replacing Cloud Functions' built-in `context.auth`)
- Role-based authorization (tenant, landlord, agent, admin) - re-checked server-side on every privileged action, not just hidden in the UI
- Account role is chosen once at signup and permanently locked by Firestore rules (self-serve signup can only create `tenant`/`landlord` accounts - `admin`/`agent` require manual provisioning)

### Rate Limiting

The unauthenticated/public-facing endpoints are rate-limited (`backend/server/src/middleware.ts`): `checkoutInitiate` (10 requests / 15 min) and both `webhooks/nomba` and `webhooks/monnify` (60 requests / min each), to blunt abuse of the payment-provider-facing surface.

---

## 📊 Data Models

### Firestore Collections

**users**
```typescript
{
  uid: string;                // Firebase Auth UID
  email: string;
  role: 'tenant' | 'landlord' | 'agent' | 'admin';
  displayName: string;
  nombaAccountId?: string;    // For receiving Nomba disbursements
  monnifyPayoutAccount?: {    // For receiving Monnify disbursements
    accountNumber: string;
    bankCode: string;
    accountName: string;
  };
  createdAt: Timestamp;
}
```

**listings**
```typescript
{
  listingId: string;
  propertyName: string;
  address: string;
  monthlyRent: number;        // In kobo (minor units)
  landlordUid: string;
  agentUid?: string;
  splitConfigId: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
}
```

**transactions**
```typescript
{
  transactionId: string;
  transactionReference: string;  // Unique, sent as the payment reference to whichever provider collected it
  listingId: string;
  tenantUid: string;
  landlordUid: string;
  agentUid?: string;
  amount: number;                // In kobo
  status: 'pending_payment' | 'funds_held' | 'verification_submitted' | 
          'verified' | 'verification_rejected' | 'completed' | 'refunded';
  splitConfigSnapshot: {
    landlordPercentage: number;
    agentPercentage: number;
    platformPercentage: number;
  };
  // Which provider collected (and later disburses/refunds) this transaction.
  // Absent on records predating Monnify support - treated as 'nomba'.
  paymentProvider?: 'nomba' | 'monnify';
  nombaCheckoutUrl?: string;
  nombaPaymentReference?: string;
  monnifyCheckoutUrl?: string;
  monnifyPaymentReference?: string;
  verificationDeadline: Timestamp;
  verificationDocumentUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Sub-collection: disbursements
  disbursements: {
    [recipientUid: string]: {
      recipientType: 'landlord' | 'agent' | 'platform';
      amount: number;
      status: 'transfer_pending' | 'disbursed' | 'transfer_failed';
      nombaTransferReference?: string;
      monnifyTransferReference?: string;
    }
  }
}
```

**splitConfigs**
```typescript
{
  splitConfigId: string;
  name: string;
  landlordPercentage: number;    // Must sum to 100
  agentPercentage: number;
  platformPercentage: number;
  status: 'active' | 'inactive';
}
```

**auditLogs**
```typescript
{
  logId: string;
  transactionId?: string;
  eventType: 'transaction_status_change' | 'nomba_api_call' | 'monnify_api_call' | 'webhook_received' | 'verification_action';
  actor: string;                 // UID or 'system'
  description: string;
  metadata: Record<string, any>;
  timestamp: Timestamp;
}
```

---

## 🐛 Troubleshooting

### Webhook not firing

1. Verify the webhook URL configured in the Monnify/Nomba dashboard matches
   the deployed Render URL (`/api/webhooks/monnify` or `/api/webhooks/nomba`)
2. For Nomba, check `NOMBA_WEBHOOK_SECRET` is set and matches the dashboard
3. For Monnify, remember the `monnify-signature` header is only sent in
   **production**, not sandbox - a missing webhook in sandbox is expected;
   reconciliation polling (`POST /api/checkPaymentStatus`, or the
   `/api/internal/reconcile-payments` cron sweep) confirms the payment anyway
4. Check the Render service logs (or local console output) for signature
   validation errors - `[WEBHOOK]` (Nomba) or `[MONNIFY_WEBHOOK]` (Monnify)

### Payment not completing

1. Verify the API key/secret for the chosen provider is correct
   (`MONNIFY_TEST_API_KEY`/`MONNIFY_TEST_SECRET_KEY` or
   `NOMBA_TEST_CLIENT_ID`/`NOMBA_TEST_PRIVATE_KEY`)
2. Check the sandbox account has sufficient balance
3. Use the test cards listed under Testing above
4. Check the Render service logs for API errors (`[MONNIFY]`/`[NOMBA]` prefixed)

### Authentication issues

1. Verify Google Sign-In is enabled in Firebase Console
2. Check Firebase config is correct in `.env` files
3. Verify authorized domains in Firebase Console (localhost, production domain)

### Firestore permission errors

1. Deploy latest security rules: `firebase deploy --only firestore:rules`
2. Verify user has correct role in `users` collection
3. Check Firebase console for rule evaluation errors

---

## 📝 License

MIT License - see [`LICENSE`](LICENSE).

---

## 🎓 Learning Resources

- [Monnify API Documentation](https://developers.monnify.com) / [API Reference](https://developers.monnify.com/api)
- [Monnify Feature Cheat Sheet](docs/monnify/README.md) (this repo's own summary of the Monnify surface used)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Nomba API Documentation](https://docs.nomba.com)
- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org/docs)

---
