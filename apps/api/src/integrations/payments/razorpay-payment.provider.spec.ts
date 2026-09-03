import { createHmac } from "node:crypto";
import { RazorpayPaymentProvider } from "./razorpay-payment.provider";

/**
 * Build plan §08 treats an unverified payment webhook as a critical
 * vulnerability — anyone who could forge a "payment succeeded" webhook
 * could unlock a match without ever paying. This is the test that keeps
 * that guarantee honest.
 */
describe("RazorpayPaymentProvider.verifyWebhookSignature", () => {
  const secret = "test-webhook-secret";
  const provider = new RazorpayPaymentProvider();

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  function sign(body: string): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  it("accepts a correctly signed payload", () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const result = provider.verifyWebhookSignature({
      rawBody: Buffer.from(rawBody),
      signatureHeader: sign(rawBody),
    });
    expect(result).toBe(true);
  });

  it("rejects a payload whose signature doesn't match", () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const result = provider.verifyWebhookSignature({
      rawBody: Buffer.from(rawBody),
      signatureHeader: sign('{"event":"something-else"}'),
    });
    expect(result).toBe(false);
  });

  it("rejects a payload that was tampered with after signing", () => {
    const originalBody = JSON.stringify({ event: "payment.captured", amount: 100 });
    const signature = sign(originalBody);
    const tamperedBody = JSON.stringify({ event: "payment.captured", amount: 100000 });

    const result = provider.verifyWebhookSignature({
      rawBody: Buffer.from(tamperedBody),
      signatureHeader: signature,
    });
    expect(result).toBe(false);
  });

  it("fails closed (rejects) when no webhook secret is configured", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const result = provider.verifyWebhookSignature({
      rawBody: Buffer.from(rawBody),
      signatureHeader: sign(rawBody),
    });
    expect(result).toBe(false);
  });

  it("rejects an empty signature header rather than throwing", () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    expect(() =>
      provider.verifyWebhookSignature({ rawBody: Buffer.from(rawBody), signatureHeader: "" }),
    ).not.toThrow();
    const result = provider.verifyWebhookSignature({
      rawBody: Buffer.from(rawBody),
      signatureHeader: "",
    });
    expect(result).toBe(false);
  });
});
