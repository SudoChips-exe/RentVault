import path from 'path';
import express, { Express } from 'express';
import * as admin from 'firebase-admin';
import next from 'next';

// Local dev only - Render (and any other real deploy) injects env vars
// directly, so there's no .env file there and this silently no-ops. Reuses
// backend/functions/.env rather than duplicating it, since both apps read
// the same Firebase/Nomba credentials.
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: path.join(__dirname, '../../functions/.env') });
}

import { config, assertRequiredConfig } from './config';

// Fail fast on a misconfigured deploy rather than surfacing as an obscure
// runtime error deep inside a request.
assertRequiredConfig();

// Normalizes whatever shape the private key arrives in as an env var - a
// literal "\n"-escaped single line (the usual .env format), a real
// multi-line value (common when pasted into a host's dashboard textarea),
// or either of those with stray \r from a Windows clipboard mixed in. OpenSSL
// 3's PEM parser is far stricter than OpenSSL 1.1 about exactly this kind of
// malformed-but-"close enough" input (this is what "error:1E08010C:DECODER
// routines::unsupported" from firebase-admin/gRPC actually means in practice).
function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}

const normalizedPrivateKey = normalizePrivateKey(config.firebase.privateKey);

// Diagnostic only - none of this leaks the key body itself (PEM
// header/footer/line-count aren't secret), but it's enough to tell whether
// the deployed env var is actually well-formed PEM without guessing blind
// again. Two prior fixes (Alpine->Debian base image, --openssl-legacy-provider)
// didn't resolve the "DECODER routines::unsupported" gRPC crash on Firestore
// calls, so the next data point needs to come from the actual runtime, not
// another local repro that can't reproduce it.
const keyLines = normalizedPrivateKey.split('\n');
console.log('[BOOT] Runtime:', {
  nodeVersion: process.version,
  arch: process.arch,
  platform: process.platform,
  opensslVersion: process.versions.openssl,
});
console.log('[BOOT] Private key diagnostic:', {
  length: normalizedPrivateKey.length,
  lineCount: keyLines.length,
  firstLine: keyLines[0],
  lastLine: keyLines[keyLines.length - 1],
  startsWithHeader: normalizedPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----'),
  endsWithFooter: normalizedPrivateKey.endsWith('-----END PRIVATE KEY-----'),
  hasCarriageReturns: config.firebase.privateKey.includes('\r'),
});

// Must run before importing any route module - each one calls
// admin.firestore() at its own top level, which throws if the default app
// isn't initialized yet.
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: config.firebase.projectId,
    clientEmail: config.firebase.clientEmail,
    privateKey: normalizedPrivateKey,
  }),
});

import { errorHandler } from './middleware';
import { webhookRouter } from './routes/webhook';
import { checkoutRouter } from './routes/checkout';
import { verificationRouter } from './routes/verification';
import { tenantVerificationRouter } from './routes/tenant-verification';
import { refundRouter } from './refund';
import { adminApiRouter } from './routes/admin-api';
import { receiptRouter } from './routes/receipt';
import { internalRouter } from './routes/internal';
import { reconcileRouter } from './routes/reconcile';

const FRONTEND_DIST = path.join(__dirname, '../../../frontend/dist');
const DASHBOARDS_DIR = path.join(__dirname, '../../../dashboards');

async function main() {
  const app: Express = express();
  // Render sits behind a reverse proxy - without this, express-rate-limit
  // (and req.ip generally) would see the proxy's IP for every request
  // instead of the real client IP.
  app.set('trust proxy', 1);

  const apiRouter = express.Router();
  // webhooks/nomba needs the raw body for signature validation, so it must
  // be mounted before the JSON body parser touches the request.
  apiRouter.use(webhookRouter);
  apiRouter.use(express.json());
  apiRouter.get('/health', (_req, res) => res.json({ ok: true }));
  apiRouter.use(checkoutRouter);
  apiRouter.use(verificationRouter);
  apiRouter.use(tenantVerificationRouter);
  apiRouter.use(refundRouter);
  apiRouter.use(adminApiRouter);
  apiRouter.use(receiptRouter);
  apiRouter.use(internalRouter);
  apiRouter.use(reconcileRouter);
  app.use('/api', apiRouter);

  const nextApp = next({ dev: false, dir: DASHBOARDS_DIR });
  await nextApp.prepare();
  const nextHandler = nextApp.getRequestHandler();

  app.use((req, res, nextFn) => {
    if (req.path.startsWith('/dashboard')) {
      nextHandler(req, res);
      return;
    }
    nextFn();
  });

  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ code: 'not-found', message: 'Not found' });
      return;
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });

  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`[SERVER] Listening on port ${config.port}`);
  });
}

main().catch((error) => {
  console.error('[SERVER] Failed to start', error);
  process.exit(1);
});
