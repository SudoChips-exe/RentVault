import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { nombaClient } from './nomba-client';
import { generateTransactionReference, TRANSACTION_STATUSES } from './models';
import { logTransactionStatusChange, logNombaApiCall } from './audit-logger';
import { config } from './config';

const db = admin.firestore();

export const checkoutInitiate = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to initiate checkout'
    );
  }

  const tenantUid = context.auth.uid;

  const userDoc = await db.collection('users').doc(tenantUid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User profile not found'
    );
  }

  const user = userDoc.data()!;
  if (user.role !== 'tenant') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only tenants can initiate checkout'
    );
  }

  if (user.verificationStatus !== 'approved') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Complete tenant verification before paying rent'
    );
  }

  if (!data.listingId || typeof data.listingId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'listingId is required'
    );
  }

  const listingDoc = await db.collection('listings').doc(data.listingId).get();
  if (!listingDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'Listing not found'
    );
  }

  const listing = listingDoc.data()!;
  if (listing.status !== 'active') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Listing is not active'
    );
  }

  const transactionReference = generateTransactionReference();

  const webhookBaseUrl = config.nomba.webhookBaseUrl
    || `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net`;

  let checkoutUrl: string;
  try {
    const checkout = await nombaClient.createCheckout({
      amount: listing.monthlyRent,
      reference: transactionReference,
      customerEmail: user.email || 'tenant@example.com',
      customerName: user.displayName || 'Tenant',
      webhookUrl: `${webhookBaseUrl}/webhook-listener`,
      metadata: {
        listingId: data.listingId,
        tenantUid,
      },
    });
    checkoutUrl = checkout.checkoutUrl;

    await logNombaApiCall('/checkout', transactionReference, 200);
  } catch (error: any) {
    functions.logger.error('[CHECKOUT] Nomba API error', error);
    await logNombaApiCall('/checkout', transactionReference, error.response?.status || 500);
    throw new functions.https.HttpsError(
      'unavailable',
      'Payment provider unavailable, please try again'
    );
  }

  const transactionData = {
    transactionReference,
    listingId: data.listingId,
    tenantUid,
    landlordUid: listing.landlordUid,
    agentUid: listing.agentUid || null,
    amount: listing.monthlyRent,
    status: TRANSACTION_STATUSES.PENDING_PAYMENT,
    splitConfigSnapshot: {},
    nombaCheckoutUrl: checkoutUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const splitConfigDoc = listing.splitConfigId
    ? await db.collection('splitConfigs').doc(listing.splitConfigId).get()
    : null;

  if (splitConfigDoc?.exists) {
    const config = splitConfigDoc.data()!;
    transactionData.splitConfigSnapshot = {
      landlordPercentage: config.landlordPercentage,
      agentPercentage: config.agentPercentage,
      platformPercentage: config.platformPercentage,
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

  functions.logger.log(`[CHECKOUT] Transaction created ${transactionId}`, {
    reference: transactionReference,
    amount: listing.monthlyRent,
  });

  return {
    checkoutUrl,
    transactionId,
  };
});
