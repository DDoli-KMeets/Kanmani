import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  WebhookVerificationInput,
} from "./payment-provider.interface";

/**
 * Real Razorpay integration. Order creation is a documented stub (no
 * merchant account exists yet — see docs/ENVIRONMENT.md for setup once you
 * register a company and open one). Webhook signature verification IS fully
 * implemented per Razorpay's documented HMAC-SHA256 scheme, since that logic
 * doesn't need a live account to write or test correctly, and getting it
 * exactly right matters — build plan §08 treats an unverified webhook as a
 * critical vulnerability.
 */
@Injectable()
export class RazorpayPaymentProvider implements PaymentProvider {
  async createOrder(_input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error(
        "PAYMENT_PROVIDER=razorpay but RAZORPAY_KEY_ID/SECRET are not set. See docs/ENVIRONMENT.md.",
      );
    }
    throw new Error(
      "RazorpayPaymentProvider.createOrder is a documented stub — call Razorpay's Orders API " +
        "(https://razorpay.com/docs/api/orders/) once you have a merchant account. Keep " +
        "PAYMENT_PROVIDER=mock until then.",
    );
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return false;

    const expected = createHmac("sha256", secret)
      .update(input.rawBody)
      .digest("hex");

    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(input.signatureHeader, "utf8");

    // Constant-time comparison — a naive `===` would leak timing information
    // an attacker could use to forge a valid signature byte by byte.
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
