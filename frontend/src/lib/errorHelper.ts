export type ApiErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'not-found'
  | 'unavailable'
  | 'failed-precondition'
  | 'internal'
  | 'unknown';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: string;
  isRetryable: boolean;
}

export function parseFirebaseError(error: any): ApiError {
  const code: ApiErrorCode = error?.code?.replace('functions/', '') || 'unknown';
  const rawMsg: string = error?.message || 'An unexpected error occurred.';

  switch (code) {
    case 'unauthenticated':
      return {
        code,
        message: 'Session expired. Please sign in again.',
        isRetryable: false,
      };
    case 'permission-denied':
      return {
        code,
        message: 'You do not have permission to perform this action.',
        isRetryable: false,
      };
    case 'invalid-argument':
      return {
        code,
        message: rawMsg.replace('functions/invalid-argument: ', '') || 'Invalid request. Please check your inputs.',
        isRetryable: false,
      };
    case 'not-found':
      return {
        code,
        message: 'The requested resource was not found.',
        isRetryable: false,
      };
    case 'unavailable':
      return {
        code,
        message: 'Payment provider unavailable. Please try again in a moment.',
        details: 'If this persists, contact support.',
        isRetryable: true,
      };
    case 'failed-precondition':
      return {
        code,
        message: rawMsg.replace('functions/failed-precondition: ', '') || 'Action cannot be performed in current state.',
        isRetryable: false,
      };
    case 'internal':
      return {
        code,
        message: rawMsg.replace('functions/internal: ', '') || 'A server error occurred. Please try again.',
        isRetryable: true,
      };
    default:
      return {
        code: 'unknown',
        message: 'An unexpected error occurred. Please try again.',
        isRetryable: true,
      };
  }
}

export function formatAmount(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira);
}

export function formatDate(date: any): string {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatCountdown(deadline: any): { text: string; urgent: boolean } {
  if (!deadline) return { text: 'No deadline', urgent: false };
  const d = deadline.toDate ? deadline.toDate() : new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();

  if (diff <= 0) return { text: 'Expired', urgent: true };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return {
      text: `${hours}h ${minutes}m remaining`,
      urgent: hours < 6,
    };
  }
  return { text: `${minutes}m remaining`, urgent: true };
}

export function getStatusLabel(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending_payment: { label: 'Pending Payment', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    funds_held: { label: 'Funds in Escrow', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    verification_submitted: { label: 'Verification Submitted', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    verified: { label: 'Verified', color: 'text-brand-400', bg: 'bg-brand-400/10' },
    verification_rejected: { label: 'Verification Rejected', color: 'text-red-400', bg: 'bg-red-400/10' },
    verification_timeout: { label: 'Verification Timeout', color: 'text-orange-400', bg: 'bg-orange-400/10' },
    disbursement_pending: { label: 'Disbursement Pending', color: 'text-blue-300', bg: 'bg-blue-300/10' },
    completed: { label: 'Completed', color: 'text-brand-400', bg: 'bg-brand-400/10' },
    disbursement_partial_failure: { label: 'Partial Disbursement Failure', color: 'text-red-500', bg: 'bg-red-500/10' },
    refund_initiated: { label: 'Refund Initiated', color: 'text-orange-400', bg: 'bg-orange-400/10' },
    refunded: { label: 'Refunded', color: 'text-slate-400', bg: 'bg-slate-400/10' },
    refund_failed: { label: 'Refund Failed', color: 'text-red-500', bg: 'bg-red-500/10' },
  };
  return map[status] || { label: status, color: 'text-slate-300', bg: 'bg-slate-300/10' };
}
