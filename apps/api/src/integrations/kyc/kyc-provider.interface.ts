export const KYC_PROVIDER = "KYC_PROVIDER";

export interface KycSubmission {
  userId: string;
  documentType: "PAN" | "PASSPORT";
  /** Base64 or object-storage reference to the KYC video — never a raw ID number. */
  videoReference: string;
}

export interface KycVerificationResult {
  providerReferenceId: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}

/**
 * Every KYC provider (mock, Digio, Signzy) implements this. The rest of the
 * app only ever sees "verified / pending / rejected" — never a raw PAN,
 * Passport number or the video itself, which is exactly the data-
 * minimization rule from build plan §08.
 */
export interface KycProvider {
  submit(submission: KycSubmission): Promise<KycVerificationResult>;
  checkStatus(providerReferenceId: string): Promise<KycVerificationResult>;
}
