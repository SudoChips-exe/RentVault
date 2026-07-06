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

// Must run before importing any route module - each one calls
// admin.firestore() at its own top level, which throws if the default app
// isn't initialized yet.
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: config.firebase.projectId,
    clientEmail: config.firebase.clientEmail,
    privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
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
