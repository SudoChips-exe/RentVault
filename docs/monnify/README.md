# Monnify API Feature Cheat Sheet

Source: [`monnify-api-cheat-sheet.pdf`](./monnify-api-cheat-sheet.pdf) (APIConf Hackathon reference sheet).

This maps the core Monnify API feature categories to when to use each, for evaluating a Monnify
integration alongside the existing [Nomba integration](../../backend/server/src/nomba-client.ts).

## 1. Payment Collection

- **One-Time Web/Mobile Checkout** — secure multi-channel widget (Cards, USSD, Transfer) for
  immediate individual sales. Best for standard checkouts or one-off payments.
  Docs: Monnify Web SDK Integration
- **Customer Reserved Accounts** — permanent, dedicated bank account numbers assigned to a
  specific user. Good for wallets/savings apps needing instant transfer funding.
  Docs: Reserved Account Architecture
- **Dynamic & Static Invoices** — trackable custom invoices with amounts, line items, expiration
  (up to 6 months). Good for B2B billing, recurring utility billing, marketplace orders.
  Docs: Invoice Payments Overview
- **Card Tokenization** — saves card data on first transaction for headless future debits. Good for
  subscriptions/recurring memberships.
  Docs: Tokenized Payments (Recurring)
- **Direct Debit Mandates** — authorised mandate to pull variable funds from a customer's bank
  account on a schedule. Good for loan repayments, recurring investments, postpaid billing.
  Docs: Direct Debit Mandates Introduction
- **Offline Pay-ins (Moniepoint Agents)** — fixed/variable/invoice-based "Offline Products" payable
  with cash at any Moniepoint POS. Good for unbanked/cash-reliant users.
  Docs: Offline Pay-ins Developer Guide
  - Requires implementing a mandatory **Payer Verification Endpoint** on your server — Monnify
    calls it in real time to verify the user/invoice before cash is accepted.

## 2. Payouts & Disbursements (Transfers)

- **Single Transfers** — real-time programmatic disbursement from your Monnify wallet to any
  Nigerian bank account or mobile wallet. Good for instant withdrawals, P2P, vendor payouts.
  Docs: Single Transfer Flow
- **Bulk Transfers** — up to 5,000 payouts in a single batch API request. Good for payroll,
  affiliate payouts, bulk vendor settlements.
  Docs: Bulk Transfer Pipeline
- **Paycode API** — secure 10-digit cash redemption codes for physical withdrawal at Moniepoint
  agent points. Good for financial inclusion / unbanked users without a debit card.
  Docs: Monnify Paycode API

## 3. Advanced Settlement Tools

- **Transaction Splitting / SubAccount** — automatically divides an incoming payment across two+
  sub-accounts by percentage or amount. Good for marketplace platform-fee-before-vendor-payout
  flows — relevant for RentVault's landlord disbursement model.
  Docs: Sub-Accounts & Split Payments
- **Refunds API** — instant full/partial rollback to the customer's original payment source. Good
  for cancellations, returns, dispute resolution.
  Docs: Refund Transactions API

## 4. Identity & Verification

- **Verification APIs (KYC Match)** — validates bank account details (Name Enquiry), BVN, or NIN
  against registries. Good for onboarding compliance, fraud prevention, validating payout account
  names before a transfer.
  Docs: Verification & Identity Methods

## 5. Value Added Services (VAS)

- **Bills Payment API** — query billers and vend utility subscriptions, airtime, data. Good for
  embedding lifestyle utility features.
  Docs: Bill Payment Integration

## Pro-Tips

1. **Webhook Verification** — handle incoming webhooks for final transaction status instead of
   polling GET status endpoints; cleaner, faster, respects rate limits.
   Docs: Monnify Webhooks
2. **Offline Payer Verification** — Offline Pay-ins require a mandatory Payer Verification Endpoint
   on the backend (see above).
3. **MFA Toggle** — OTP is on by default in the Sandbox disbursement wallet. For headless/demo
   payouts, contact Monnify support to disable OTP on disbursement.

## References

- Monnify Docs: https://developers.monnify.com
- Monnify API Reference: https://developers.monnify.com/api
- Monnify Open API Spec: https://developers.monnify.com/collection/monnify-collection.yml
- Monnify MCP Server: https://developers.monnify.com/docs/integration/mcp-server
- Integration Tools: https://developers.monnify.com/docs/integration
- Support: integration-support@monnify.com
