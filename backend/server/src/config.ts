export const config = {
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },
  nomba: {
    env: process.env.NOMBA_ENV || 'test',
    parentAccountId: process.env.NOMBA_PARENT_ACCOUNT_ID || '',
    subAccountId: process.env.NOMBA_SUB_ACCOUNT_ID || '',
    liveClientId: process.env.NOMBA_LIVE_CLIENT_ID || '',
    livePrivateKey: process.env.NOMBA_LIVE_PRIVATE_KEY || '',
    testClientId: process.env.NOMBA_TEST_CLIENT_ID || '',
    testPrivateKey: process.env.NOMBA_TEST_PRIVATE_KEY || '',
    webhookSecret: process.env.NOMBA_WEBHOOK_SECRET || '',
    baseUrl: process.env.NOMBA_BASE_URL || 'https://api.nomba.com',
    webhookBaseUrl: process.env.NOMBA_WEBHOOK_BASE_URL || '',
  },
  verification: {
    timeoutHours: parseInt(process.env.VERIFICATION_TIMEOUT_HOURS || '48', 10),
  },
  internalCronSecret: process.env.INTERNAL_CRON_SECRET || '',
  port: parseInt(process.env.PORT || '3001', 10),
};

// Called once at boot (see index.ts) so a missing/misconfigured env var
// fails loudly at startup instead of surfacing later as an obscure runtime
// error deep inside a request (e.g. a webhook silently failing signature
// validation because NOMBA_WEBHOOK_SECRET was never set).
export function assertRequiredConfig(): void {
  const missing: string[] = [];

  if (!config.firebase.projectId) missing.push('FIREBASE_PROJECT_ID');
  if (!config.firebase.privateKey) missing.push('FIREBASE_PRIVATE_KEY');
  if (!config.firebase.clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!config.nomba.parentAccountId) missing.push('NOMBA_PARENT_ACCOUNT_ID');
  if (!config.nomba.subAccountId) missing.push('NOMBA_SUB_ACCOUNT_ID');
  if (!config.nomba.webhookSecret) missing.push('NOMBA_WEBHOOK_SECRET');
  if (!config.internalCronSecret) missing.push('INTERNAL_CRON_SECRET');

  if (config.nomba.env === 'test') {
    if (!config.nomba.testClientId) missing.push('NOMBA_TEST_CLIENT_ID');
    if (!config.nomba.testPrivateKey) missing.push('NOMBA_TEST_PRIVATE_KEY');
  } else {
    if (!config.nomba.liveClientId) missing.push('NOMBA_LIVE_CLIENT_ID');
    if (!config.nomba.livePrivateKey) missing.push('NOMBA_LIVE_PRIVATE_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `[CONFIG] Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Set them before starting the server (see README setup instructions).'
    );
  }
}
