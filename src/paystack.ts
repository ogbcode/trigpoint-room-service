import { createHmac } from 'node:crypto';
import { safeEqual } from './auth.js';
import { config } from './config.js';
import {
  CURRENCY,
  HttpMethod,
  PAYSTACK_BASE_URL,
  PAYSTACK_STATUS,
  PAYSTACK_TIMEOUT_MS,
  PaymentStatus,
  PaystackStatus,
  Route,
} from './constants.js';

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackTransaction {
  status: string;
  amount: number;
  currency: string;
}

const PAYSTACK_STATUSES = new Set<string>(Object.values(PaystackStatus));

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
  });
  const body = (await response.json()) as PaystackResponse<T>;
  if (!response.ok || !body.status) {
    throw new Error(`Paystack ${path} failed with ${response.status}: ${body.message}`);
  }
  return body.data;
}

export function initializeTransaction(input: { email: string; amountKobo: number; reference: string }) {
  return request<{ authorization_url: string }>('/transaction/initialize', {
    method: HttpMethod.POST,
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: CURRENCY,
      reference: input.reference,
      callback_url: `${config.serverUrl}${Route.PAYSTACK_CALLBACK}`,
    }),
  });
}

export async function verifyTransaction(reference: string): Promise<{
  status: PaymentStatus;
  amountKobo: number;
  currency: string;
}> {
  const transaction = await request<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (!PAYSTACK_STATUSES.has(transaction.status)) {
    throw new Error(`Unhandled Paystack status "${transaction.status}" for ${reference}`);
  }
  return {
    status: PAYSTACK_STATUS[transaction.status as PaystackStatus],
    amountKobo: transaction.amount,
    currency: transaction.currency,
  };
}

export function isValidSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac('sha512', config.paystackSecretKey).update(rawBody).digest('hex');
  return safeEqual(signature, expected);
}
