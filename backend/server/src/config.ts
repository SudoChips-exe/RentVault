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
    // Derived from NOMBA_ENV unless explicitly overridden - a real production
    // bug came from NOMBA_BASE_URL being left pointed at sandbox.nomba.com
    // after NOMBA_ENV was switched to "live", silently sending live
    // credentials to the sandbox API (checkouts succeeded, but as fake
    // sandbox transactions - no real money ever moved). See the hard check
    // in assertRequiredConfig below.
    baseUrl: process.env.NOMBA_BASE_URL ||
      (process.env.NOMBA_ENV === 'test' ? 'https://sandbox.nomba.com' : 'https://api.nomba.com'),
    webhookBaseUrl: process.env.NOMBA_WEBHOOK_BASE_URL || '',
  },
  verification: {
    timeoutHours: parseInt(process.env.VERIFICATION_TIMEOUT_HOURS || '48', 10),
  },
  // Document storage (receipts) - Supabase Storage, not Firebase Storage,
  // since a Firebase Storage bucket now requires the paid Blaze plan even to
  // stay within its free-tier limits.
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
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
  if (!config.supabase.url) missing.push('SUPABASE_URL');
  if (!config.supabase.anonKey) missing.push('SUPABASE_ANON_KEY');
  if (!config.internalCronSecret) missing.push('INTERNAL_CRON_SECRET');

  if (config.nomba.env === 'test') {
    if (!config.nomba.testClientId) missing.push('NOMBA_TEST_CLIENT_ID');
    if (!config.nomba.testPrivateKey) missing.push('NOMBA_TEST_PRIVATE_KEY');
  } else {
    if (!config.nomba.liveClientId) missing.push('NOMBA_LIVE_CLIENT_ID');
    if (!config.nomba.livePrivateKey) missing.push('NOMBA_LIVE_PRIVATE_KEY');
  }

  // Hard-fail, not a warning - this exact mismatch caused checkouts to
  // silently succeed against Nomba's sandbox using live credentials, meaning
  // no real money was ever actually collected despite NOMBA_ENV=live.
  const baseUrlLooksSandbox = config.nomba.baseUrl.includes('sandbox');
  if (config.nomba.env !== 'test' && baseUrlLooksSandbox) {
    missing.push(
      `NOMBA_BASE_URL (currently "${config.nomba.baseUrl}") points at sandbox while ` +
      'NOMBA_ENV=live - set it to https://api.nomba.com or remove it entirely'
    );
  }
  if (config.nomba.env === 'test' && !baseUrlLooksSandbox) {
    missing.push(
      `NOMBA_BASE_URL (currently "${config.nomba.baseUrl}") doesn't point at sandbox while ` +
      'NOMBA_ENV=test - set it to https://sandbox.nomba.com or remove it entirely'
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `[CONFIG] Missing or invalid environment variable(s): ${missing.join(', ')}. ` +
      'Set them before starting the server (see README setup instructions).'
    );
  }

  // Not required to boot - reconciliation polling (reconcile.ts,
  // internal.ts) confirms payments without it, which matters since setting
  // this up needs Nomba dashboard access this project doesn't have yet. But
  // any real webhook delivery fails signature validation until it's set, so
  // this is worth a loud reminder rather than silence.
  if (!config.nomba.webhookSecret) {
    console.warn(
      '[CONFIG] NOMBA_WEBHOOK_SECRET is not set - webhook deliveries will fail ' +
      'signature validation. Payment confirmation still works via reconciliation ' +
      'polling in the meantime (see reconcile.ts).'
    );
  }
}
