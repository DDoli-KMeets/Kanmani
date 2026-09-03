import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import { PAYMENT_PROVIDER } from "../../integrations/payments/payment-provider.interface";
import type { PaymentProvider } from "../../integrations/payments/payment-provider.interface";
import { MatchingService } from "../matching/matching.service";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly matching: MatchingService,
  ) {}

  async createOrderForBooking(userId: string, bookingId: string, amountPaise: number) {
    const { providerOrderId } = await this.provider.createOrder({
      amountPaise,
      receiptId: bookingId,
    });

    const [payment] = await this.db
      .insert(schema.payments)
      .values({
        userId,
        purpose: "BOOKING",
        bookingId,
        amountPaise,
        provider: process.env.PAYMENT_PROVIDER ?? "mock",
        providerOrderId,
        idempotencyKey: randomUUID(),
      })
      .returning();

    return payment;
  }

  async createOrderForEventRsvp(userId: string, eventRsvpId: string, amountPaise: number) {
    const { providerOrderId } = await this.provider.createOrder({
      amountPaise,
      receiptId: eventRsvpId,
    });

    const [payment] = await this.db
      .insert(schema.payments)
      .values({
        userId,
        purpose: "EVENT_RSVP",
        eventRsvpId,
        amountPaise,
        provider: process.env.PAYMENT_PROVIDER ?? "mock",
        providerOrderId,
        idempotencyKey: randomUUID(),
      })
      .returning();

    return payment;
  }

  /**
   * Dev/test-only confirmation path used when PAYMENT_PROVIDER=mock, since
   * there's no real Razorpay checkout to complete against. Never available
   * once a real provider is configured — see the guard below.
   */
  async confirmMockPayment(userId: string, paymentId: string) {
    if ((process.env.PAYMENT_PROVIDER ?? "mock") !== "mock") {
      throw new ForbiddenException("Mock payment confirmation is disabled outside of development.");
    }

    const [payment] = await this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId))
      .limit(1);

    if (!payment) throw new NotFoundException("Payment not found.");
    if (payment.userId !== userId) throw new ForbiddenException("This isn't your payment.");
    if (payment.status !== "CREATED") {
      throw new BadRequestException(`Payment already ${payment.status.toLowerCase()}.`);
    }

    await this.markPaid(payment.id);
    return { ...payment, status: "PAID" as const };
  }

  /** Real Razorpay webhook handler — signature-verified per build plan §08. */
  async handleRazorpayWebhook(rawBody: Buffer, signatureHeader: string): Promise<void> {
    const isValid = this.provider.verifyWebhookSignature({ rawBody, signatureHeader });
    if (!isValid) {
      this.logger.warn("Rejected a payment webhook with an invalid signature.");
      throw new ForbiddenException("Invalid webhook signature.");
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    const providerOrderId: string | undefined = event?.payload?.payment?.entity?.order_id;
    if (!providerOrderId) return;

    const [payment] = await this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.providerOrderId, providerOrderId))
      .limit(1);
    if (!payment || payment.status !== "CREATED") return; // Idempotent: already processed or unknown order.

    if (event.event === "payment.captured") {
      await this.markPaid(payment.id, event?.payload?.payment?.entity?.id);
    } else if (event.event === "payment.failed") {
      await this.db
        .update(schema.payments)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(schema.payments.id, payment.id));
    }
  }

  private async markPaid(paymentId: string, providerPaymentId?: string) {
    const [payment] = await this.db
      .update(schema.payments)
      .set({
        status: "PAID",
        providerPaymentId: providerPaymentId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.payments.id, paymentId))
      .returning();

    if (payment.purpose === "BOOKING" && payment.bookingId) {
      await this.matching.enqueueTryMatch(payment.bookingId);
    }
  }
}
