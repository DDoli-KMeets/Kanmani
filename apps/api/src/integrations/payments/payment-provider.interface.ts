export const PAYMENT_PROVIDER = "PAYMENT_PROVIDER";

export interface CreateOrderInput {
  amountPaise: number;
  receiptId: string;
}

export interface CreateOrderResult {
  providerOrderId: string;
}

export interface WebhookVerificationInput {
  rawBody: Buffer | string;
  signatureHeader: string;
}

/**
 * Every payment provider (mock, Razorpay) implements this. Card numbers
 * never pass through our backend either way — real payments use Razorpay's
 * hosted checkout, so the most sensitive data never touches our servers.
 */
export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  /** Must be constant-time and provider-signature-based — never trust a webhook body alone. */
  verifyWebhookSignature(input: WebhookVerificationInput): boolean;
}
