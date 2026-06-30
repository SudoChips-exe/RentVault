# RentVault
**Rent without the gamble.**

DevCareer × Nomba Hackathon — Integrations & Plugins Track

---

## The Problem

Renting in Nigeria runs on trust, because the system has no mechanism to verify it. A tenant finds a listing, meets someone calling themselves the landlord or agent, and — because the market convention is one or two years of rent paid upfront — wires a sum of money that, for most people, represents their entire savings. There is no inspection requirement, no escrow, no cooling-off period. Once the transfer clears, the transaction is irreversible regardless of who was actually on the other end of it.

This is the exact mechanism behind the most common rental fraud patterns in the country: agents who don't own or have no authority over the property they're "renting," landlords who collect deposits from multiple tenants for the same unit and disappear, and omo-onile disputes where ownership itself is contested after money has already changed hands. The EFCC publishes regular warnings about these patterns. Every property blog in Nigeria has a "how to avoid rental scams" post. None of that changes the underlying structural fact: by the time the advice would matter, the money has already moved.

The severity is what makes this specifically a Nigerian problem and not a generic global one. In rental markets where rent is paid monthly, a scam costs a renter one month's money — painful, recoverable. In Nigeria, where the cultural and market norm is paying a full year (often more) upfront, a single successful scam can erase a young professional's, a student's, or a family's entire liquid savings in one transaction.

## The Solution

RentVault is a rent escrow platform that removes the moment where trust is assumed and replaces it with a moment where trust is proven — before any money changes hands between tenant and landlord.

The mechanic:

1. **Tenant pays in full**, via Nomba Checkout, into a held state. The money is not in the landlord's account and not in RentVault's general accounts — it sits in an explicitly tracked, auditable held state tied to that specific transaction.
2. **Landlord or agent submits verification** — proof of ownership or a valid tenancy agreement — through the platform.
3. **An admin reviews and approves or rejects** that verification, with a configurable timeout if no action is taken.
4. **On approval**, Nomba's Transfers API automatically splits the held funds according to a configurable percentage split — landlord, agent, and platform fee — and disburses to each party's registered Nomba account, no manual bank transfers involved.
5. **On rejection or timeout**, Nomba's Refunds API automatically returns the full amount to the tenant. This isn't a customer-support escalation path — it's the system's default behavior when verification fails.

Every state transition — held, verification submitted, verified, disbursed, refunded — is driven by Nomba webhooks, not by anyone manually updating a status. The tenant's protection is enforced by the payment infrastructure itself, not by a promise from RentVault or goodwill from the other party.

## Why This Is a Real Integration, Not a Feature Bolted On

RentVault has no product without Nomba. Checkout is the entry point that gets funds into a held state in the first place. Transfers is the mechanism that performs the split-disbursement that makes escrow meaningful rather than just a holding pen. Refunds is what makes the safety promise actually true rather than aspirational marketing copy. Webhooks are the nervous system connecting all of it — every meaningful state change in the product is a direct, real-time reaction to a Nomba payment event. Remove any one of these four pieces and the core mechanic stops functioning; this is not a payment button attached to an otherwise-independent idea.

## What's Built

This is a working product, not a concept slide:

- **Tenant-facing app** (React + Vite): listing search, listing detail, checkout flow, and a live transaction status view showing the escrow state in real time.
- **Landlord dashboard** (Next.js 14): listing management, Nomba account setup, verification submission.
- **Admin dashboard** (Next.js 14): verification approve/reject queue, configurable split-config management, manual refund handling, audit log.
- **Backend** (Firebase Cloud Functions, TypeScript): checkout initiation, webhook handling, verification logic, disbursement triggering, timeout scheduling, and a full audit trail of every transaction's lifecycle.
- **Data layer**: Firestore for transactions, listings, split configurations, users, and audit logs; Firebase Storage for verification documents; Firebase Auth with role-based access across tenant, landlord, agent, and admin roles.

## Market Opportunity

Nigeria's rental market is large, almost entirely informal, and increasingly digital on the payments side — but digital trust infrastructure hasn't caught up to digital payment adoption. That gap is precisely where fraud concentrates, and precisely where a payments platform like Nomba is positioned to close it: not through another consumer-awareness campaign, but through infrastructure that changes what's possible to do with money at the protocol level. RentVault's split-disbursement model also generalizes beyond residential rent — the same escrow-plus-verification mechanic applies to short-let bookings, commercial leases, and any transaction where one party needs proof before funds release to a counterparty they've never met in person.

## The Ask / What's Next

RentVault is functional end-to-end on Nomba's sandbox environment today. The next steps are hardening the verification workflow for higher document-fraud sophistication (cross-referencing submitted documents against land registry data where APIs exist), expanding beyond a single split-config model to support multi-agent and co-agency listings, and moving from hackathon demo to a pilot with a small set of real Lagos listings to validate the verification turnaround time against actual landlord/agent behavior.

## Closing

Every piece of rental-scam advice in Nigeria — verify the landlord, inspect before you pay, don't trust agents who avoid in-person meetings — exists because the system gives people no other defense. RentVault doesn't add another item to that list. It replaces the moment where that advice was the only thing standing between a renter and their life savings with a system where the money simply can't move until trust has been proven.

**RentVault. Built on Nomba. Rent without the gamble.**