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
    baseUrl: process.env.NOMBA_BASE_URL || 'https://api.nomba.com/v1',
    webhookBaseUrl: process.env.NOMBA_WEBHOOK_BASE_URL || '',
  },
  platform: {
    nombaAccountId: process.env.PLATFORM_NOMBA_ACCOUNT_ID || '',
  },
  verification: {
    timeoutHours: parseInt(process.env.VERIFICATION_TIMEOUT_HOURS || '48', 10),
  },
  internalCronSecret: process.env.INTERNAL_CRON_SECRET || '',
  port: parseInt(process.env.PORT || '3001', 10),
};
