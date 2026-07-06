import { NextFunction, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import rateLimit from 'express-rate-limit';
import { ApiError } from './api-error';
import { config } from './config';

function rateLimitHandler(req: Request, res: Response) {
  res.status(429).json({ code: 'unavailable', message: 'Too many requests. Please try again shortly.' });
}

// checkoutInitiate is authenticated but still worth capping - a compromised
// or malicious token shouldn't be able to spam Nomba checkout creation.
export const checkoutRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// webhooks/nomba is unauthenticated and internet-facing (Nomba calls it
// directly) - generous enough for legitimate webhook bursts, tight enough
// to blunt abuse from arbitrary traffic hitting the public endpoint.
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Privileged write actions (verification submit/approve/reject, manual
// refund, receipt generation) - a compromised or malicious token shouldn't
// be able to hammer money-movement or document-review endpoints.
export const sensitiveActionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Paginated admin read endpoints (transactions, audit logs) - looser than
// the write limiter since dashboards legitimately poll/paginate these.
export const adminReadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export interface AuthedRequest extends Request {
  uid?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer (.+)$/);
    if (!match) {
      throw new ApiError('unauthenticated', 'You must be signed in');
    }
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.uid = decoded.uid;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError('unauthenticated', 'You must be signed in'));
  }
}

export function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-internal-secret'];
  if (!config.internalCronSecret || secret !== config.internalCronSecret) {
    return next(new ApiError('permission-denied', 'Invalid internal secret'));
  }
  next();
}

// Express error-handling middleware (4-arg signature is what marks it as
// such) - keep this mounted last, after all routes.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ code: err.code, message: err.message });
  }
  const asError = err as { stack?: string; cause?: unknown; code?: unknown; details?: unknown };
  console.error('[SERVER] Unhandled error', err);
  // gRPC ServiceErrors (e.g. the Firestore "DECODER routines::unsupported"
  // crash) print as a flat {code, details, metadata} object via console.error
  // with no visible JS stack or nested cause - log these explicitly in case
  // there's a wrapped cause with the actual underlying crypto error.
  if (asError?.stack) console.error('[SERVER] Error stack:', asError.stack);
  if (asError?.cause) console.error('[SERVER] Error cause:', asError.cause);
  return res.status(500).json({ code: 'internal', message: 'Server error. Please try again.' });
}

export function asyncRoute(
  handler: (req: AuthedRequest, res: Response) => Promise<void>
) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
