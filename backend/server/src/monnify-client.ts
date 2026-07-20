import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from './config';

interface MonnifyConfig {
  contractCode: string;
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  sourceAccountNumber: string;
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

interface LoginResponse {
  responseBody: {
    accessToken: string;
    expiresIn: number;
  };
}

export class MonnifyClient {
  private client: AxiosInstance;
  private config: MonnifyConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(customConfig?: Partial<MonnifyConfig>) {
    const isTest = config.monnify.env === 'test';

    this.config = {
      contractCode: customConfig?.contractCode || config.monnify.contractCode || '',
      apiKey: customConfig?.apiKey || (isTest
        ? config.monnify.testApiKey
        : config.monnify.liveApiKey) || '',
      secretKey: customConfig?.secretKey || (isTest
        ? config.monnify.testSecretKey
        : config.monnify.liveSecretKey) || '',
      baseUrl: customConfig?.baseUrl || config.monnify.baseUrl || 'https://api.monnify.com',
      sourceAccountNumber: customConfig?.sourceAccountNumber || config.monnify.sourceAccountNumber || '',
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const basicAuth = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString('base64');
      const response = await axios.post<LoginResponse>(
        `${this.config.baseUrl}/api/v1/auth/login`,
        {},
        { headers: { Authorization: `Basic ${basicAuth}` } }
      );

      this.accessToken = response.data.responseBody.accessToken;
      // expiresIn is seconds-from-now, unlike Nomba's absolute expiresAt
      // timestamp - subtract a minute so we refresh slightly early.
      this.tokenExpiry = Date.now() + response.data.responseBody.expiresIn * 1000 - 60_000;

      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      return this.accessToken!;
    } catch (error) {
      console.error('[MONNIFY] Failed to obtain access token', error);
      throw error;
    }
  }

  private async request<T>(method: string, path: string, data?: unknown): Promise<T> {
    await this.ensureToken();
    const response = await this.client.request<T>({ method, url: path, data });
    return response.data;
  }

  // Same kobo-internally/naira-at-the-API-boundary rule as Nomba's client -
  // this app stores money in kobo everywhere (see formatAmountNaira in
  // models.ts), but Monnify's amount fields are decimal Naira (major unit).
  private koboToNairaNumber(kobo: number): number {
    return Number((kobo / 100).toFixed(2));
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
      const response = await this.request<{
        responseBody: { checkoutUrl: string; paymentReference?: string };
      }>('POST', '/api/v1/merchant/transactions/init-transaction', {
        amount: this.koboToNairaNumber(params.amount),
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        paymentReference: params.reference,
        paymentDescription: 'Rent payment',
        currencyCode: 'NGN',
        contractCode: this.config.contractCode,
        redirectUrl: params.callbackUrl,
        metadata: params.metadata,
      });
      return {
        checkoutUrl: response.responseBody.checkoutUrl,
        reference: response.responseBody.paymentReference || params.reference,
      };
    }, 'createCheckout');
  }

  async initiateTransfer(params: {
    amount: number;
    reference: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
    destinationAccountName: string;
    narration?: string;
  }): Promise<TransferResponse> {
    return this.withRetry(async () => {
      const response = await this.request<{
        responseBody: { status?: string; reference?: string; transactionReference?: string };
      }>('POST', '/api/v2/disbursements/single', {
        amount: this.koboToNairaNumber(params.amount),
        reference: params.reference,
        narration: params.narration || 'Rent disbursement',
        destinationBankCode: params.destinationBankCode,
        destinationAccountNumber: params.destinationAccountNumber,
        destinationAccountName: params.destinationAccountName,
        currency: 'NGN',
        sourceAccountNumber: this.config.sourceAccountNumber,
      });
      // PENDING_AUTHORIZATION means MFA/OTP is enabled on the disbursement
      // wallet and the transfer is waiting on Authorize Transfer - surfaced
      // as-is rather than mapped to 'pending' so it's distinguishable in logs
      // from a normal in-flight transfer.
      return {
        reference: response.responseBody.reference || response.responseBody.transactionReference || params.reference,
        status: response.responseBody.status || 'pending',
      };
    }, 'initiateTransfer');
  }

  async initiateRefund(params: {
    paymentReference: string;
    amount: number;
    reference: string;
  }): Promise<RefundResponse> {
    return this.withRetry(async () => {
      const response = await this.request<{
        responseBody: { refundStatus?: string };
      }>('POST', '/api/v1/refunds/initiate-refund', {
        transactionReference: params.paymentReference,
        refundReference: params.reference,
        refundAmount: this.koboToNairaNumber(params.amount),
        refundReason: 'RentVault refund',
        // Capped at 16 chars by Monnify - shows on the customer's bank alert.
        customerNote: 'Rent refund',
      });
      const refundStatus = response.responseBody.refundStatus;
      return {
        reference: params.reference,
        status: refundStatus === 'FAILED' ? 'failed' : 'pending',
      };
    }, 'initiateRefund');
  }

  // Reconciliation fallback for confirming a payment without relying on the
  // webhook, same role as Nomba's findTransactionByReference. Returns null if
  // Monnify has no record of it yet.
  async findTransactionByReference(
    paymentReference: string
  ): Promise<{ status: string; amount: number; monnifyTransactionId: string } | null> {
    return this.withRetry(async () => {
      const response = await this.request<{
        responseBody: {
          paymentStatus: string;
          amountPaid: number;
          transactionReference: string;
        } | null;
      }>('GET', `/api/v1/transactions/verify_by_reference?reference=${encodeURIComponent(paymentReference)}`);

      const body = response.responseBody;
      if (!body) return null;

      // Normalized to Nomba's 'SUCCESS' string so reconcile.ts/internal.ts can
      // check the same literal regardless of which provider a transaction used.
      return {
        status: body.paymentStatus === 'PAID' ? 'SUCCESS' : body.paymentStatus,
        amount: Math.round(body.amountPaid * 100),
        monnifyTransactionId: body.transactionReference,
      };
    }, 'findTransactionByReference').catch((error: unknown) => {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) return null;
      throw error;
    });
  }

  // Monnify signs SHA-512(secretKey + rawBody) hex-encoded, sent in the
  // 'monnify-signature' header - per Monnify's docs this header is only sent
  // in production, not sandbox, so this can't be exercised against sandbox
  // test deliveries. Reconciliation polling (reconcile.ts/internal.ts) is the
  // fallback in the meantime, same as it already is for Nomba.
  validateWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.config.secretKey) {
      console.error('[MONNIFY] Secret key not configured');
      return false;
    }
    if (!signature) {
      return false;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHash('sha512')
      .update(this.config.secretKey + rawBody)
      .digest('hex');

    try {
      const signatureBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');
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
          console.error(`[MONNIFY] Non-retryable error on ${operationName}`, {
            statusCode,
            error: axiosError.message,
          });
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.warn(`[MONNIFY] Retrying ${operationName} after ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }
}

export const monnifyClient = new MonnifyClient();
