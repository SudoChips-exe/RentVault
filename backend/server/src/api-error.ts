// Mirrors the subset of Firebase's functions.https.HttpsError codes actually
// used across the ported routes, so the frontend's existing
// parseFirebaseError() (dashboards/app/lib/errorHelper.ts) keeps working
// unmodified - it only inspects error.code and error.message.
export type ApiErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'not-found'
  | 'unavailable'
  | 'failed-precondition'
  | 'internal';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  'permission-denied': 403,
  'invalid-argument': 400,
  'not-found': 404,
  unavailable: 503,
  'failed-precondition': 412,
  internal: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}
