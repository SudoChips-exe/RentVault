export function parseFirebaseError(error: any): { code: string; message: string; isRetryable: boolean } {
  const code: string = error?.code?.replace('functions/', '') || 'unknown';
  const rawMsg: string = error?.message || '';

  switch (code) {
    case 'unauthenticated':
      return { code, message: 'Session expired. Please sign in again.', isRetryable: false };
    case 'permission-denied':
      return { code, message: 'You do not have permission to perform this action.', isRetryable: false };
    case 'invalid-argument':
      return {
        code,
        message: rawMsg.replace('functions/invalid-argument: ', '') || 'Invalid input.',
        isRetryable: false,
      };
    case 'not-found':
      return { code, message: 'The requested resource was not found.', isRetryable: false };
    case 'unavailable':
      return { code, message: 'Payment provider unavailable. Please try again.', isRetryable: true };
    case 'failed-precondition':
      return {
        code,
        message: rawMsg.replace('functions/failed-precondition: ', '') || 'Action cannot be performed.',
        isRetryable: false,
      };
    case 'internal':
      return {
        code,
        message: rawMsg.replace('functions/internal: ', '') || 'Server error. Please try again.',
        isRetryable: true,
      };
    default:
      return { code: 'unknown', message: 'An unexpected error occurred.', isRetryable: true };
  }
}

export function formatAmount(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100);
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
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return { text: 'Expired', urgent: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return { text: `${hours}h ${minutes}m remaining`, urgent: hours < 6 };
  return { text: `${minutes}m remaining`, urgent: true };
}

export function getStatusLabel(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending_payment: { label: 'Pending Payment', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
    funds_held: { label: 'Funds in Escrow', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
    verification_submitted: { label: 'Awaiting Review', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
    verified: { label: 'Verified', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
    verification_rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
    verification_timeout: { label: 'Timed Out', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
    disbursement_pending: { label: 'Disbursing', color: 'text-blue-300', bg: 'bg-blue-300/10 border-blue-300/20' },
    completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
    disbursement_partial_failure: { label: 'Partial Failure', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
    refund_initiated: { label: 'Refund Initiated', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
    refunded: { label: 'Refunded', color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/20' },
    refund_failed: { label: 'Refund Failed', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  };
  return map[status] || { label: status, color: 'text-slate-300', bg: 'bg-slate-300/10 border-slate-300/20' };
}
