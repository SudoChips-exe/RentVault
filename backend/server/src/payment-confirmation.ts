import * as admin from 'firebase-admin';
import { TRANSACTION_STATUSES } from './models';
import { logTransactionStatusChange } from './audit-logger';
import { config } from './config';

const db = admin.firestore();

// Shared by both the webhook's payment_success handler and reconciliation
// polling (webhook.ts, reconcile.ts, internal.ts), since a payment can now be
// confirmed through either path - the status guard inside the Firestore
// transaction makes it safe for both to race without double-processing.
export async function confirmPaymentReceived(
  transactionId: string,
  amount: number,
  providerPaymentReference: string,
  actor: string,
  provider: 'nomba' | 'monnify' = 'nomba'
): Promise<boolean> {
  const transactionRef = db.collection('transactions').doc(transactionId);

  const didTransition = await db.runTransaction(async (tx: admin.firestore.Transaction) => {
    const snap = await tx.get(transactionRef);
    if (!snap.exists) return false;
    if (snap.data()!.status !== TRANSACTION_STATUSES.PENDING_PAYMENT) return false;

    // Countdown starts once funds actually land in escrow, not at checkout
    // initiation - read by the landlord/tenant "verification deadline"
    // countdown UI and by the timeout checker (internal.ts).
    const verificationDeadline = admin.firestore.Timestamp.fromMillis(
      Date.now() + config.verification.timeoutHours * 60 * 60 * 1000
    );

    const referenceField = provider === 'monnify' ? 'monnifyPaymentReference' : 'nombaPaymentReference';

    tx.update(transactionRef, {
      status: TRANSACTION_STATUSES.FUNDS_HELD,
      [referenceField]: providerPaymentReference,
      amount,
      verificationDeadline,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (didTransition) {
    await logTransactionStatusChange(
      transactionId,
      TRANSACTION_STATUSES.PENDING_PAYMENT,
      TRANSACTION_STATUSES.FUNDS_HELD,
      actor
    );
    console.log(`[PAYMENT] Confirmed for ${transactionId} (${actor}), status -> funds_held`);
  }

  return didTransition;
}
