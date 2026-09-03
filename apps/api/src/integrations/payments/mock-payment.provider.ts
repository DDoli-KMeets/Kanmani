import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  WebhookVerificationInput,
} from "./payment-provider.interface";

/**
 * Development-only stand-in for Razorpay. No real money moves. Orders are
 * created instantly and "paid" via a simple confirm endpoint used only in
 * dev/test — see PaymentsService.confirmMockPayment.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger("MockPayment");

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const providerOrderId = `mock_order_${randomUUID()}`;
    this.logger.log(
      `[MOCK PAYMENT] Created order ${providerOrderId} for ₹${(input.amountPaise / 100).toFixed(2)} (receipt ${input.receiptId})`,
    );
    return { providerOrderId };
  }

  verifyWebhookSignature(_input: WebhookVerificationInput): boolean {
    // The mock provider never receives real webhooks; confirmation happens
    // via PaymentsService.confirmMockPayment instead, so this always fails
    // closed rather than accepting an unverified request.
    return false;
  }
}
