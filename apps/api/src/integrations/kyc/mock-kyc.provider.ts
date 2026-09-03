import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  KycProvider,
  KycSubmission,
  KycVerificationResult,
} from "./kyc-provider.interface";

/**
 * Development-only stand-in for a real KYC vendor. Auto-approves after a
 * short simulated delay so the rest of the product (booking, matching,
 * reveal) can be built and tested end-to-end before a real Digio/Signzy
 * account exists. Never used when KYC_PROVIDER is set to a real vendor.
 */
@Injectable()
export class MockKycProvider implements KycProvider {
  private readonly logger = new Logger("MockKyc");
  private readonly pending = new Map<string, KycVerificationResult>();

  async submit(submission: KycSubmission): Promise<KycVerificationResult> {
    const providerReferenceId = `mock_${randomUUID()}`;
    const result: KycVerificationResult = {
      providerReferenceId,
      status: "PENDING",
    };
    this.pending.set(providerReferenceId, result);
    this.logger.log(
      `[MOCK KYC] Received ${submission.documentType} submission for user ${submission.userId} → ${providerReferenceId}. Auto-verifying.`,
    );

    // Simulate the provider's real turnaround (your deck cites 2–4 hours)
    // compressed to a few seconds so local development stays fast.
    setTimeout(() => {
      this.pending.set(providerReferenceId, {
        providerReferenceId,
        status: "VERIFIED",
      });
    }, 3000);

    return result;
  }

  async checkStatus(providerReferenceId: string): Promise<KycVerificationResult> {
    return (
      this.pending.get(providerReferenceId) ?? {
        providerReferenceId,
        status: "REJECTED",
        rejectionReason: "Unknown reference id.",
      }
    );
  }
}
