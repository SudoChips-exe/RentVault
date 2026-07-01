import * as admin from 'firebase-admin';

export type TenantVerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export interface User {
  uid: string;
  email: string;
  role: 'tenant' | 'landlord' | 'agent' | 'admin';
  displayName: string;
  nombaAccountId?: string;
  verificationStatus?: TenantVerificationStatus;
  verificationDocuments?: {
    idDocumentUrl?: string;
    incomeProofUrl?: string;
  };
  verificationRejectionReason?: string;
  verificationSubmittedAt?: admin.firestore.Timestamp;
  verificationReviewedAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface Listing {
  listingId: string;
  propertyName: string;
  address: string;
  monthlyRent: number;
  landlordUid: string;
  agentUid?: string;
  splitConfigId: string;
  status: 'active' | 'inactive';
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface SplitConfigSnapshot {
  landlordPercentage: number;
  agentPercentage: number;
  platformPercentage: number;
}

export interface Disbursement {
  recipientType: 'landlord' | 'agent' | 'platform';
  amount: number;
  nombaTransferReference?: string;
  status: 'transfer_pending' | 'disbursed' | 'transfer_failed' | 'transfer_initiation_failed';
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type TransactionStatus =
  | 'pending_payment'
  | 'funds_held'
  | 'verification_submitted'
  | 'verified'
  | 'verification_rejected'
  | 'verification_timeout'
  | 'disbursement_pending'
  | 'completed'
  | 'disbursement_partial_failure'
  | 'refund_initiated'
  | 'refunded'
  | 'refund_failed';

export interface Transaction {
  transactionId: string;
  transactionReference: string;
  listingId: string;
  tenantUid: string;
  landlordUid: string;
  agentUid?: string;
  amount: number;
  status: TransactionStatus;
  splitConfigSnapshot: SplitConfigSnapshot;
  verificationDeadline?: admin.firestore.Timestamp;
  verificationDocumentUrl?: string;
  nombaCheckoutUrl?: string;
  nombaPaymentReference?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface SplitConfig {
  splitConfigId: string;
  name: string;
  landlordPercentage: number;
  agentPercentage: number;
  platformPercentage: number;
  status: 'active' | 'inactive';
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export type AuditEventType =
  | 'transaction_status_change'
  | 'nomba_api_call'
  | 'webhook_received'
  | 'verification_action';

export interface AuditLog {
  logId: string;
  transactionId?: string;
  eventType: AuditEventType;
  actor: string;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: admin.firestore.Timestamp;
}

export const TRANSACTION_STATUSES = {
  PENDING_PAYMENT: 'pending_payment' as TransactionStatus,
  FUNDS_HELD: 'funds_held' as TransactionStatus,
  VERIFICATION_SUBMITTED: 'verification_submitted' as TransactionStatus,
  VERIFIED: 'verified' as TransactionStatus,
  VERIFICATION_REJECTED: 'verification_rejected' as TransactionStatus,
  VERIFICATION_TIMEOUT: 'verification_timeout' as TransactionStatus,
  DISBURSEMENT_PENDING: 'disbursement_pending' as TransactionStatus,
  COMPLETED: 'completed' as TransactionStatus,
  DISBURSEMENT_PARTIAL_FAILURE: 'disbursement_partial_failure' as TransactionStatus,
  REFUND_INITIATED: 'refund_initiated' as TransactionStatus,
  REFUNDED: 'refunded' as TransactionStatus,
  REFUND_FAILED: 'refund_failed' as TransactionStatus,
} as const;

export function validateSplitPercentages(
  landlord: number,
  agent: number,
  platform: number
): { valid: boolean; error?: string } {
  const total = landlord + agent + platform;
  if (Math.abs(total - 100) > 0.01) {
    return { valid: false, error: `Split percentages must sum to 100, got ${total}` };
  }
  if (landlord < 0 || agent < 0 || platform < 0) {
    return { valid: false, error: 'Split percentages must be non-negative' };
  }
  return { valid: true };
}

export function validateTransactionStatusTransition(
  current: TransactionStatus,
  next: TransactionStatus
): boolean {
  const allowedTransitions: Record<TransactionStatus, TransactionStatus[]> = {
    pending_payment: ['funds_held'],
    funds_held: ['verification_submitted', 'verification_timeout', 'refund_initiated'],
    verification_submitted: ['verified', 'verification_rejected', 'refund_initiated'],
    verified: ['disbursement_pending', 'completed'],
    verification_rejected: ['refund_initiated'],
    verification_timeout: ['refund_initiated'],
    disbursement_pending: ['completed', 'disbursement_partial_failure'],
    completed: [],
    disbursement_partial_failure: [],
    refund_initiated: ['refunded', 'refund_failed'],
    refunded: [],
    refund_failed: [],
  };
  return allowedTransitions[current]?.includes(next) ?? false;
}

export function generateTransactionReference(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RENT-${timestamp}-${random}`;
}

export function formatAmountNaira(kobo: number): string {
  const naira = kobo / 100;
  return `NGN ${naira.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function calculateDisbursementAmounts(
  totalAmount: number,
  splitConfig: SplitConfigSnapshot
): { landlordAmount: number; agentAmount: number; platformAmount: number } {
  const validation = validateSplitPercentages(
    splitConfig.landlordPercentage,
    splitConfig.agentPercentage,
    splitConfig.platformPercentage
  );
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const rawLandlord = (totalAmount * splitConfig.landlordPercentage) / 100;
  const rawAgent = (totalAmount * splitConfig.agentPercentage) / 100;
  const rawPlatform = (totalAmount * splitConfig.platformPercentage) / 100;

  const landlordAmount = Math.floor(rawLandlord);
  const agentAmount = Math.floor(rawAgent);
  const platformAmount = Math.floor(rawPlatform);

  let remainder = totalAmount - landlordAmount - agentAmount - platformAmount;

  const diffs = [
    { key: 'landlordAmount' as const, diff: rawLandlord - landlordAmount },
    { key: 'agentAmount' as const, diff: rawAgent - agentAmount },
    { key: 'platformAmount' as const, diff: rawPlatform - platformAmount },
  ].sort((a, b) => b.diff - a.diff);

  const result = { landlordAmount, agentAmount, platformAmount };
  for (let i = 0; i < remainder && i < diffs.length; i++) {
    result[diffs[i].key] += 1;
  }

  return result;
}
