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
  access_token: string;
  expires_in: number;
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
      baseUrl: customConfig?.baseUrl || config.nomba.baseUrl || 'https://api.nomba.com/v1',
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
      const response = await axios.post<TokenResponse>(`${this.config.baseUrl}/auth/token`, {
        client_id: this.config.clientId,
        private_key: this.config.privateKey,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;

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
    webhookUrl: string;
    metadata?: Record<string, unknown>;
  }): Promise<CheckoutResponse> {
    return this.withRetry(async () => {
      const response = await this.request<{ data: { checkout_url: string; reference: string } }>(
        'POST', '/checkout', {
          amount: params.amount,
          reference: params.reference,
          sub_account_id: this.config.subAccountId,
          customer: {
            email: params.customerEmail,
            name: params.customerName,
          },
          webhook_url: params.webhookUrl,
          metadata: params.metadata,
        },
      );
      return {
        checkoutUrl: response.data.checkout_url,
        reference: response.data.reference || params.reference,
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
      const response = await this.request<{ data: { reference: string; status: string } }>(
        'POST', '/transfers', {
          amount: params.amount,
          reference: params.reference,
          sub_account_id: this.config.subAccountId,
          recipient: params.recipientAccountId,
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
      const response = await this.request<{ data: { reference: string; status: string } }>(
        'POST', '/refunds', {
          payment_reference: params.paymentReference,
          amount: params.amount,
          reference: params.reference,
          sub_account_id: this.config.subAccountId,
        },
      );
      return {
        reference: response.data.reference || params.reference,
        status: response.data.status || 'pending',
      };
    }, 'initiateRefund');
  }

  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      console.error('[NOMBA] Webhook secret not configured');
      return false;
    }
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
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
