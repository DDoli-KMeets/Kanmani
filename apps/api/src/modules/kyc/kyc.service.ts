import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import { KYC_PROVIDER } from "../../integrations/kyc/kyc-provider.interface";
import type { KycProvider } from "../../integrations/kyc/kyc-provider.interface";
import type { SubmitKycDto } from "./dto/submit-kyc.dto";

@Injectable()
export class KycService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KYC_PROVIDER) private readonly kycProvider: KycProvider,
  ) {}

  async submit(userId: string, dto: SubmitKycDto) {
    const [existing] = await this.db
      .select()
      .from(schema.kycVerifications)
      .where(eq(schema.kycVerifications.userId, userId))
      .limit(1);

    if (existing?.status === "VERIFIED") {
      throw new BadRequestException("Your account is already verified.");
    }

    const result = await this.kycProvider.submit({
      userId,
      documentType: dto.documentType,
      videoReference: dto.videoReference,
    });

    const values = {
      userId,
      provider: process.env.KYC_PROVIDER ?? "mock",
      providerReferenceId: result.providerReferenceId,
      status: result.status,
      documentType: dto.documentType,
      submittedAt: new Date(),
      decidedAt: result.status === "PENDING" ? null : new Date(),
      rejectionReason: result.rejectionReason ?? null,
      updatedAt: new Date(),
    };

    if (existing) {
      await this.db
        .update(schema.kycVerifications)
        .set(values)
        .where(eq(schema.kycVerifications.userId, userId));
    } else {
      await this.db.insert(schema.kycVerifications).values(values);
    }

    return this.getStatus(userId);
  }

  /**
   * Polls the provider for an update and reconciles the stored status.
   * Simple, correct approach for MVP scale (no separate webhook receiver or
   * cron worker needed yet); revisit if KYC volume ever makes polling on
   * every status check too chatty against the provider.
   */
  async getStatus(userId: string) {
    const [record] = await this.db
      .select()
      .from(schema.kycVerifications)
      .where(eq(schema.kycVerifications.userId, userId))
      .limit(1);

    if (!record) {
      return { status: "NOT_STARTED" as const };
    }

    if (record.status === "PENDING" && record.providerReferenceId) {
      const fresh = await this.kycProvider.checkStatus(record.providerReferenceId);
      if (fresh.status !== record.status) {
        // We only reach here when the provider has moved off PENDING (the
        // outer `if` already established record.status === "PENDING" and
        // this one that fresh.status differs), so the new status is always
        // a decided one — VERIFIED or REJECTED.
        await this.db
          .update(schema.kycVerifications)
          .set({
            status: fresh.status,
            decidedAt: new Date(),
            rejectionReason: fresh.rejectionReason ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.kycVerifications.userId, userId));
        return { ...record, status: fresh.status };
      }
    }

    return record;
  }

  /** Used by BookingsService to enforce "verified users only" at booking time. */
  async isVerified(userId: string): Promise<boolean> {
    const status = await this.getStatus(userId);
    return status.status === "VERIFIED";
  }
}
