import { Injectable } from "@nestjs/common";
import type {
  KycProvider,
  KycSubmission,
  KycVerificationResult,
} from "./kyc-provider.interface";

/**
 * Real Digio (or Signzy) integration. Documented stub — no vendor account
 * exists yet (per the founder's answer in the build plan). Wire this up
 * once you've signed up and have DIGIO_CLIENT_ID / DIGIO_CLIENT_SECRET —
 * see docs/ENVIRONMENT.md for exactly where to get them and paste them in.
 */
@Injectable()
export class DigioKycProvider implements KycProvider {
  async submit(_submission: KycSubmission): Promise<KycVerificationResult> {
    throw new Error(
      "DigioKycProvider is a documented stub — implement the real Digio Video KYC API call before using it in production. Keep KYC_PROVIDER=mock until then.",
    );
  }

  async checkStatus(_providerReferenceId: string): Promise<KycVerificationResult> {
    throw new Error("DigioKycProvider is a documented stub — see submit().");
  }
}
