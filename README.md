# RentVault System

A web application that enables secure rent payments with automatic escrow, landlord verification, and instant split disbursements to landlords, agents, and platforms using the Nomba payment API. Firestore, Firebase Auth, and Firebase Storage remain the system of record; the backend API is deployed to Render as a container rather than Firebase Cloud Functions (which require the paid Blaze plan).

---

## 🎯 Overview

**The Problem:** Traditional rent payments lack transparency and trust. Tenants need assurance that their payment reaches the rightful landlord, while landlords and agents need instant, automated disbursements.

**The Solution:** RentVault holds tenant payments in escrow, verifies landlord/agent credentials, and automatically splits funds to all parties—or refunds tenants if verification fails.

### Key Features

✅ **Secure Payments** - Nomba Checkout API integration with escrow holding  
✅ **Verification Flow** - Document upload and admin approval for landlord authentication  
✅ **Automatic Split Transfers** - Instant disbursement to landlord, agent, and platform  
✅ **Automatic Refunds** - Timeout-based refund if verification fails  
✅ **Real-Time Updates** - Live transaction status via Firestore listeners  
✅ **Audit Trail** - Complete transaction history for compliance  

---

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Express (TypeScript) - deployed as a single Docker container on Render (free tier). Replaces the original Firebase Cloud Functions backend, which requires the paid Blaze plan to deploy.
- Firestore (Database) - unchanged, still Firebase, accessed via the Admin SDK from the Express server
- Firebase Storage (Document uploads) - unchanged
- Firebase Auth (Google Sign-In) - unchanged; the Express server verifies Firebase ID tokens on each request instead of relying on Cloud Functions' built-in `context.auth`
- Nomba API (Checkout, Transfers, Refunds, Webhooks)

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
       │ 2. Pay rent via Nomba Checkout
       ▼
┌─────────────────────────┐
│  Nomba Checkout API     │
│  (Payment Gateway)      │
└──────────┬──────────────┘
           │ 3. Payment confirmation webhook
           ▼
┌─────────────────────────┐
│  Backend API             │
│  (Express on Render,     │
│  reads/writes Firestore) │
└──────────┬──────────────┘
           │ 4. Funds held in escrow (Firestore status: funds_held)
           ▼
┌─────────────────────────┐
│  Landlord/Agent         │
│  (Next.js Dashboard)    │
└──────────┬──────────────┘
           │ 5. Upload verification document (Firebase Storage)
           ▼
┌─────────────────────────┐
│  Admin Dashboard        │
│  (Next.js)              │
└──────────┬──────────────┘
           │ 6. Approve/Reject verification
           │
           ├─ ✅ APPROVED ────────────┐
           │                          │
           │ 7. Trigger split         ▼
           │    disbursement    ┌──────────────────┐
           │                    │  Nomba Transfers │
           │                    │  API (3 calls)   │
           │                    └─────────┬────────┘
           │                              │
           │                    ┌─────────▼────────┐
           │                    │ Landlord (80%)   │
           │                    │ Agent (15%)      │
           │                    │ Platform (5%)    │
           │                    └──────────────────┘
           │
           └─ ❌ REJECTED OR TIMEOUT ───────┐
                                            │
                              ┌─────────────▼────────┐
                              │  Nomba Refunds API   │
                              │  (Full refund)       │
                              └─────────────┬────────┘
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
│   │   │   │   ├── checkout.ts           # POST /api/checkoutInitiate
│   │   │   │   ├── webhook.ts            # POST /api/webhook-listener
│   │   │   │   ├── verification.ts       # POST /api/verificationSubmit|Approve|Reject
│   │   │   │   ├── tenant-verification.ts
│   │   │   │   ├── admin-api.ts          # POST /api/getAllTransactions, /api/getAuditLogs
│   │   │   │   ├── receipt.ts            # POST /api/generateReceipt
│   │   │   │   └── internal.ts           # POST /api/internal/check-timeouts (cron-secret protected)
│   │   │   ├── disbursement.ts           # Split and transfer funds
│   │   │   ├── refund.ts                 # Process refunds
│   │   │   ├── audit-logger.ts           # Log all actions
│   │   │   ├── nomba-client.ts           # Nomba API wrapper
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
│   │   │   ├── ListingDetail.tsx         # View listing & pay rent
│   │   │   ├── CheckoutFlow.tsx          # Nomba Checkout redirect
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
└── README.md                             # This file
```

---

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+ and npm/bun installed
- Firebase CLI installed (`npm install -g firebase-tools`)
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

### 3. Configure Nomba API

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
(service account, for the Admin SDK), `NOMBA_ENV`, `NOMBA_BASE_URL`,
`NOMBA_PARENT_ACCOUNT_ID`, `NOMBA_SUB_ACCOUNT_ID`, `NOMBA_TEST_CLIENT_ID`/`NOMBA_TEST_PRIVATE_KEY`,
`NOMBA_WEBHOOK_SECRET`, `NOMBA_WEBHOOK_BASE_URL`,
and `INTERNAL_CRON_SECRET` (protects the `/api/internal/check-timeouts` endpoint).

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
   Render and redeploy.
5. The verification-timeout check (originally a Firebase pubsub schedule)
   runs via the GitHub Actions workflow in `.github/workflows/timeout-check.yml`
   instead, since Render's free tier has no built-in cron - add
   `RENDER_SERVICE_URL` and `INTERNAL_CRON_SECRET` as repo secrets so it can
   call `/api/internal/check-timeouts` every 15 minutes.

### 5. Configure Nomba Webhook

1. Go to Nomba Dashboard -> Developer -> Webhook Setup
2. Add webhook URL: `https://rentvault-xxxx.onrender.com/api/webhook-listener`
   (this is configured once here, not sent per-request by the API)
3. Set the signature key shown there as `NOMBA_WEBHOOK_SECRET`
4. Nomba delivers `payment_success`, `payout_success`, `payout_failed`, and
   `payment_reversal` events - `backend/server/src/routes/webhook.ts` handles
   these. Verify the payload shape against a real sandbox test delivery
   before going live; Nomba's public docs don't show a checkout-specific
   example, so the reference-matching fallback chain in `webhook.ts` is
   unconfirmed for that event.

### 6. Setup Frontend (Public Site)

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

### 7. Setup Dashboards (Next.js)

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
bun test           # business logic unit tests (models, nomba-client, error-utils)
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

### Manual Testing with Nomba Sandbox

**Test Cards:**

- **Success**: `5060990580000217227` (Verve)
- **Success**: `5531886652142950` (Mastercard)
- **Declined**: `5399838383838381`

**Test Flow:**

1. Browse listings at `http://localhost:5173/listings`
2. Click "Pay Rent" and sign in with Google
3. Complete payment with test card in Nomba Checkout
4. Verify webhook fires in the Render service logs (or local console output when running `backend/server` locally)
5. Upload verification document as landlord at `http://localhost:3000/landlord`
6. Approve verification as admin at `http://localhost:3000/admin`
7. Verify split transfers initiated in Nomba dashboard

---

## 📖 Demo Walkthrough

### For Judges

**Live Demo Script (5 minutes):**

1. **Tenant Payment Flow** (1 min)
   - Show listing search (public, no auth required)
   - Click "Pay Rent" → Sign in with Google → Nomba Checkout
   - Complete payment with test card
   - Show payment confirmation screen

2. **Webhook Processing** (1 min)
   - Open terminal with Firebase Functions logs visible
   - Point out `[WEBHOOK] checkout.success received` log
   - Open Firestore console showing transaction status change to `funds_held`

3. **Verification Flow** (1.5 min)
   - Switch to landlord dashboard
   - Show verification deadline countdown
   - Upload test PDF document
   - Switch to admin dashboard
   - Preview document and click "Approve"

4. **Split Disbursement** (1 min)
   - Show terminal logs: `[NOMBA_TRANSFER] Landlord: ₦80,000`, `[NOMBA_TRANSFER] Agent: ₦15,000`, `[NOMBA_TRANSFER] Platform: ₦5,000`
   - Show Firestore console: disbursement sub-documents with `disbursed` status
   - Show landlord dashboard: real-time disbursement status update

5. **Bonus: Refund Trigger** (0.5 min)
   - Reject a verification in admin dashboard
   - Show terminal logs: `[REFUND] Initiated for transaction RENT-xxx`
   - Show tenant view: refund status update

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

### Nomba Webhook Signature Validation

All webhook requests validate signature using Nomba webhook secret before processing.

### Firebase Auth

- Google Sign-In only (no password storage)
- Firebase ID token validation on every backend API request (`backend/server/src/middleware.ts` verifies the token via the Admin SDK on each call, replacing Cloud Functions' built-in `context.auth`)
- Role-based authorization (tenant, landlord, agent, admin) - re-checked server-side on every privileged action, not just hidden in the UI
- Account role is chosen once at signup and permanently locked by Firestore rules (self-serve signup can only create `tenant`/`landlord` accounts - `admin`/`agent` require manual provisioning)

### Rate Limiting

The two unauthenticated/public-facing endpoints are rate-limited (`backend/server/src/middleware.ts`): `checkoutInitiate` (10 requests / 15 min) and `webhook-listener` (60 requests / min), to blunt abuse of the Nomba-facing surface.

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
  nombaAccountId?: string;    // For receiving disbursements
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
  transactionReference: string;  // Unique for Nomba
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
  eventType: 'transaction_status_change' | 'nomba_api_call' | 'webhook_received';
  actor: string;                 // UID or 'system'
  description: string;
  metadata: Record<string, any>;
  timestamp: Timestamp;
}
```

---

## 🐛 Troubleshooting

### Webhook not firing

1. Verify webhook URL in Nomba dashboard matches deployed function URL
2. Check Nomba webhook secret matches Firebase config
3. Verify function has public access: `firebase functions:config:get`
4. Check Firebase Functions logs for signature validation errors

### Payment not completing

1. Verify Nomba API key is correct
2. Check Nomba sandbox account has sufficient balance
3. Use test cards from Nomba documentation
4. Check Firebase Functions logs for API errors

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

MIT License 

---


---

## 🎓 Learning Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Nomba API Documentation](https://docs.nomba.com)
- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org/docs)

---
