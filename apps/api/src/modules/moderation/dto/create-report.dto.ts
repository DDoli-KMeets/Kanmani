import { IsIn, IsOptional, IsString, IsUUID, Length } from "class-validator";

const REASONS = [
  "inappropriate_behavior",
  "safety_concern",
  "no_show",
  "fake_profile",
  "harassment",
  "other",
] as const;

export class CreateReportDto {
  @IsUUID()
  reportedUserId!: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsIn(REASONS)
  reason!: (typeof REASONS)[number];

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  details?: string;
}
