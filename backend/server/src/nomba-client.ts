import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from './config';

interface NombaConfig {
  parentAccountId: string;
  subAccountId: string;
  clientId: string;
  privateKey: string;
  webhookSecret: string;
  baseUrl: string;
}

interface CheckoutResponse {
  checkoutUrl: string;
  reference: string;
}

interface TransferResponse {
  reference: string;
  status: string;
}

interface RefundResponse {
  reference: string;
  status: string;
}

interface TokenResponse {
  data: {
    access_token: string;
    expiresAt: string;
  };
}

export class NombaClient {
  private client: AxiosInstance;
  private config: NombaConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(customConfig?: Partial<NombaConfig>) {
    const isTest = config.nomba.env === 'test';

    this.config = {
      parentAccountId: customConfig?.parentAccountId || config.nomba.parentAccountId || '',
      subAccountId: customConfig?.subAccountId || config.nomba.subAccountId || '',
      clientId: customConfig?.clientId || (isTest
        ? config.nomba.testClientId
        : config.nomba.liveClientId) || '',
      privateKey: customConfig?.privateKey || (isTest
        ? config.nomba.testPrivateKey
        : config.nomba.livePrivateKey) || '',
      webhookSecret: customConfig?.webhookSecret || config.nomba.webhookSecret || '',
      baseUrl: customConfig?.baseUrl || config.nomba.baseUrl || 'https://api.nomba.com',
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'accountId': this.config.parentAccountId,
      },
      timeout: 15000,
    });
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<TokenResponse>(
        `${this.config.baseUrl}/v1/auth/token/issue`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.privateKey,
        },
        { headers: { accountId: this.config.parentAccountId } }
      );

      this.accessToken = response.data.data.access_token;
      // expiresAt is an ISO-8601 UTC timestamp, not a seconds-from-now
      // duration - subtract a minute so we refresh slightly before Nomba
      // actually expires it.
      this.tokenExpiry = Date.parse(response.data.data.expiresAt) - 60_000;

      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      return this.accessToken!;
    } catch (error) {
      console.error('[NOMBA] Failed to obtain access token', error);
      throw error;
    }
  }

  private async request<T>(method: string, path: string, data?: unknown): Promise<T> {
    await this.ensureToken();
    const response = await this.client.request<T>({ method, url: path, data });
    return response.data;
  }

  async createCheckout(params: {
    amount: number;
    reference: string;
    customerEmail: string;
    customerName: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
  }): Promise<CheckoutResponse> {
    return this.withRetry(async () => {
      // Nomba's webhook URL is configured once in the dashboard (Developer ->
      // Webhook Setup), not per-request - there's no webhook_url field on
      // this endpoint. callbackUrl is only where Nomba's hosted checkout
      // redirects the browser after payment.
      const response = await this.request<{ data: { checkoutLink: string; orderReference: string } }>(
        'POST', '/v1/checkout/order', {
          order: {
            orderReference: params.reference,
            customerEmail: params.customerEmail,
            amount: params.amount,
            currency: 'NGN',
            accountId: this.config.subAccountId,
            callbackUrl: params.callbackUrl,
            orderMetaData: params.metadata,
          },
        },
      );
      return {
        checkoutUrl: response.data.checkoutLink,
        reference: response.data.orderReference || params.reference,
      };
    }, 'createCheckout');
  }

  async initiateTransfer(params: {
    amount: number;
    reference: string;
    recipientAccountId: string;
    narration?: string;
  }): Promise<TransferResponse> {
    return this.withRetry(async () => {
      // reference doubles as merchantTxRef, which Nomba treats as an
      // idempotency key - it must stay unique per transfer attempt.
      const response = await this.request<{ data: { reference?: string; status?: string } }>(
        'POST', '/v1/transfers/wallet', {
          amount: params.amount,
          merchantTxRef: params.reference,
          receiverAccountId: params.recipientAccountId,
          narration: params.narration || 'Rent disbursement',
        },
      );
      return {
        reference: response.data.reference || params.reference,
        status: response.data.status || 'pending',
      };
    }, 'initiateTransfer');
  }

  async initiateRefund(params: {
    paymentReference: string;
    amount: number;
    reference: string;
  }): Promise<RefundResponse> {
    return this.withRetry(async () => {
      // The refund endpoint doesn't echo back a reference/status - it just
      // confirms whether the refund request itself was accepted.
      const response = await this.request<{ data: { success: boolean; message?: string } }>(
        'POST', '/v1/checkout/refund', {
          transactionId: params.paymentReference,
          amount: params.amount,
        },
      );
      return {
        reference: params.reference,
        status: response.data.success ? 'pending' : 'failed',
      };
    }, 'initiateRefund');
  }

  // Nomba doesn't sign the raw body - it signs a colon-joined string of
  // specific fields pulled out of it, base64-encoded (see
  // developer.nomba.com/docs/api-basics/webhook). rawBody is parsed here
  // rather than passed in pre-parsed so a malformed payload just fails
  // verification instead of throwing before the signature check runs.
  validateWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean {
    if (!this.config.webhookSecret) {
      console.error('[NOMBA] Webhook secret not configured');
      return false;
    }
    if (!signature || !timestamp) {
      return false;
    }

    let hashingPayload: string;
    try {
      const parsed = JSON.parse(rawBody);
      const merchant = parsed.data?.merchant || {};
      const transaction = parsed.data?.transaction || {};
      const eventType = parsed.event_type || '';
      const requestId = parsed.requestId || '';
      const userId = merchant.userId || '';
      const walletId = merchant.walletId || '';
      const transactionId = transaction.transactionId || '';
      const transactionType = transaction.type || '';
      const transactionTime = transaction.time || '';
      let responseCode = transaction.responseCode ?? '';
      if (responseCode === 'null') responseCode = '';

      hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${responseCode}:${timestamp}`;
    } catch {
      return false;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(hashingPayload)
      .digest('base64');

    try {
      const signatureBuf = Buffer.from(signature, 'base64');
      const expectedBuf = Buffer.from(expectedSignature, 'base64');
      return (
        signatureBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(signatureBuf, expectedBuf)
      );
    } catch {
      return false;
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;

        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          console.error(`[NOMBA] Non-retryable error on ${operationName}`, {
            statusCode,
            error: axiosError.message,
          });
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.warn(`[NOMBA] Retrying ${operationName} after ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }
}

export const nombaClient = new NombaClient();
