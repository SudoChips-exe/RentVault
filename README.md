# RentVault System

A Firebase-first web application that enables secure rent payments with automatic escrow, landlord verification, and instant split disbursements to landlords, agents, and platforms using the Nomba payment API.

Built for hackathon demo in 2-3 days.

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
- Firebase Cloud Functions (TypeScript)
- Firestore (Database)
- Firebase Storage (Document uploads)
- Firebase Auth (Google Sign-In)
- Nomba API (Checkout, Transfers, Refunds)

**Frontend:**
- React + Vite + TypeScript (Public site)
- Next.js + TypeScript (Protected dashboards)
- Tailwind CSS (Styling)
- Firebase SDK (Client-side integration)

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
│  Firebase Cloud         │
│  Functions (Backend)    │
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
├── backend/                    # Firebase Cloud Functions
│   ├── functions/
│   │   ├── src/
│   │   │   ├── checkout-initiate.ts      # Create Nomba Checkout session
│   │   │   ├── webhook-listener.ts       # Process Nomba webhooks
│   │   │   ├── verification.ts           # Submit/approve/reject verification
│   │   │   ├── disbursement-trigger.ts   # Split and transfer funds
│   │   │   ├── refund-trigger.ts         # Process refunds
│   │   │   ├── timeout-scheduler.ts      # Check verification timeouts
│   │   │   ├── audit-logger.ts           # Log all actions
│   │   │   ├── admin-api.ts              # Admin endpoints
│   │   │   ├── nomba-client.ts           # Nomba API wrapper
│   │   │   └── models.ts                 # Firestore interfaces
│   │   ├── firestore.rules               # Security rules
│   │   ├── firestore.indexes.json        # Composite indexes
│   │   └── package.json
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
├── .kiro/
│   └── specs/
│       └── rent-split-escrow/
│           ├── requirements.md           # Feature requirements
│           ├── design.md                 # Architecture & data models
│           ├── backend-tasks.md          # Backend implementation tasks
│           └── frontend-tasks.md         # Frontend implementation tasks
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

**Set Firebase environment variables:**

```bash
cd backend/functions

# Set Nomba API credentials
firebase functions:config:set \
  nomba.api_key="YOUR_NOMBA_API_KEY" \
  nomba.webhook_secret="YOUR_NOMBA_WEBHOOK_SECRET" \
  nomba.base_url="https://api.nomba.com/v1"

# Set platform Nomba account ID (for receiving platform fees)
firebase functions:config:set \
  platform.nomba_account_id="YOUR_PLATFORM_ACCOUNT_ID"
```

### 4. Deploy Backend

```bash
cd backend

# Install dependencies
npm install

# Deploy Firestore rules and indexes
firebase deploy --only firestore:rules,firestore:indexes

# Deploy Cloud Functions
firebase deploy --only functions

# Note the webhook listener URL from deployment output
# Example: https://us-central1-rentvault.cloudfunctions.net/webhook-listener
```

### 5. Configure Nomba Webhook

1. Go to [Nomba Dashboard > Webhooks](https://dashboard.nomba.com/webhooks)
2. Add webhook URL from step 4 deployment output
3. Subscribe to events: `checkout.success`, `transfer.success`, `transfer.failed`, `refund.complete`

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
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
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
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
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
cd backend/functions

# Run unit tests
npm test

# Run integration tests with Firebase Emulator
npm run test:integration

# Start Firebase Emulator Suite (for local testing)
firebase emulators:start
```

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
4. Verify webhook fires in Firebase Functions logs
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
- ID token validation on all Cloud Function calls
- Role-based authorization (tenant, landlord, agent, admin)

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

MIT License - feel free to use for hackathons, demos, or production.

---

## 👥 Contributors

Built with ❤️ for hackathon demo.

For questions or support, contact: [your-email@example.com]

---

## 🎓 Learning Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Nomba API Documentation](https://docs.nomba.com)
- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Happy Hacking! 🚀**
