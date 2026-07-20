import { Router } from 'express';
import * as admin from 'firebase-admin';
import { nombaClient } from '../nomba-client';
import { monnifyClient } from '../monnify-client';
import { generateTransactionReference, TRANSACTION_STATUSES } from '../models';
import { logTransactionStatusChange, logNombaApiCall, logMonnifyApiCall } from '../audit-logger';
import { config } from '../config';
import { ApiError } from '../api-error';
import { isAxiosErrorWithStatus } from '../error-utils';
import { requireAuth, asyncRoute, AuthedRequest, checkoutRateLimit } from '../middleware';

const db = admin.firestore();

export const checkoutRouter = Router();

checkoutRouter.post('/checkoutInitiate', checkoutRateLimit, requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const tenantUid = req.uid!;

  const userDoc = await db.collection('users').doc(tenantUid).get();
  if (!userDoc.exists) {
    throw new ApiError('permission-denied', 'User profile not found');
  }

  const user = userDoc.data()!;
  if (user.role !== 'tenant') {
    throw new ApiError('permission-denied', 'Only tenants can initiate checkout');
  }

  if (user.verificationStatus !== 'approved') {
    throw new ApiError('failed-precondition', 'Complete tenant verification before paying rent');
  }

  const { listingId, provider: rawProvider } = req.body;
  if (!listingId || typeof listingId !== 'string') {
    throw new ApiError('invalid-argument', 'listingId is required');
  }

  const provider: 'nomba' | 'monnify' = rawProvider === undefined ? 'nomba' : rawProvider;
  if (provider !== 'nomba' && provider !== 'monnify') {
    throw new ApiError('invalid-argument', 'provider must be "nomba" or "monnify"');
  }

  const listingDoc = await db.collection('listings').doc(listingId).get();
  if (!listingDoc.exists) {
    throw new ApiError('not-found', 'Listing not found');
  }

  const listing = listingDoc.data()!;
  if (listing.status !== 'active') {
    throw new ApiError('failed-precondition', 'Listing is not active');
  }

  const transactionReference = generateTransactionReference();
  // Nomba's hosted checkout doesn't redirect back into RentVault in
  // practice (see ListingDetail.tsx) - this is only required by the API and
  // falls back to the app's catch-all route if Nomba ever does redirect.
  const appOrigin = config.nomba.webhookBaseUrl.replace(/\/api\/?$/, '');

  let checkoutUrl: string;
  try {
    const client = provider === 'monnify' ? monnifyClient : nombaClient;
    const checkout = await client.createCheckout({
      amount: listing.monthlyRent,
      reference: transactionReference,
      customerEmail: user.email || 'tenant@example.com',
      customerName: user.displayName || 'Tenant',
      callbackUrl: appOrigin,
      metadata: {
        listingId,
        tenantUid,
      },
    });
    checkoutUrl = checkout.checkoutUrl;

    if (provider === 'monnify') {
      await logMonnifyApiCall('/checkout', transactionReference, 200);
    } else {
      await logNombaApiCall('/checkout', transactionReference, 200);
    }
  } catch (error: unknown) {
    console.error(`[CHECKOUT] ${provider} API error`, error);
    const status = isAxiosErrorWithStatus(error) ? error.response.status : 500;
    if (provider === 'monnify') {
      await logMonnifyApiCall('/checkout', transactionReference, status);
    } else {
      await logNombaApiCall('/checkout', transactionReference, status);
    }
    throw new ApiError('unavailable', 'Payment provider unavailable, please try again');
  }

  const transactionData: Record<string, unknown> = {
    transactionReference,
    listingId,
    tenantUid,
    landlordUid: listing.landlordUid,
    agentUid: listing.agentUid || null,
    amount: listing.monthlyRent,
    status: TRANSACTION_STATUSES.PENDING_PAYMENT,
    splitConfigSnapshot: {},
    paymentProvider: provider,
    [provider === 'monnify' ? 'monnifyCheckoutUrl' : 'nombaCheckoutUrl']: checkoutUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const splitConfigDoc = listing.splitConfigId
    ? await db.collection('splitConfigs').doc(listing.splitConfigId).get()
    : null;

  if (splitConfigDoc?.exists) {
    const splitConfig = splitConfigDoc.data()!;
    transactionData.splitConfigSnapshot = {
      landlordPercentage: splitConfig.landlordPercentage,
      agentPercentage: splitConfig.agentPercentage,
      platformPercentage: splitConfig.platformPercentage,
    };
  }

  const transactionRef = await db.collection('transactions').add(transactionData);
  const transactionId = transactionRef.id;

  await transactionRef.update({ transactionId });

  await logTransactionStatusChange(
    transactionId,
    'none',
    TRANSACTION_STATUSES.PENDING_PAYMENT,
    tenantUid
  );

  console.log(`[CHECKOUT] Transaction created ${transactionId}`, {
    reference: transactionReference,
    amount: listing.monthlyRent,
  });

  res.json({ checkoutUrl, transactionId });
}));
