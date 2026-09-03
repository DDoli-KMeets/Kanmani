import { IsIn, IsOptional, IsString, Length } from "class-validator";

const DECISIONS = ["VERIFIED", "REJECTED"] as const;

export class DecideKycDto {
  @IsIn(DECISIONS)
  decision!: (typeof DECISIONS)[number];

  // Required for a rejection (the member needs to know why so they can fix
  // and resubmit); optional for an approval.
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  reason?: string;
}
