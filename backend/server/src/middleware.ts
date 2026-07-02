import { NextFunction, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { ApiError } from './api-error';
import { config } from './config';

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
  console.error('[SERVER] Unhandled error', err);
  return res.status(500).json({ code: 'internal', message: 'Server error. Please try again.' });
}

export function asyncRoute(
  handler: (req: AuthedRequest, res: Response) => Promise<void>
) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
