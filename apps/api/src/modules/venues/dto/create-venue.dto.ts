import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString, Length } from "class-validator";

const TIERS = ["CAFE", "MID", "PREMIUM", "LUXURY"] as const;

export class CreateVenueDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsString()
  @Length(1, 500)
  addressLine!: string;

  @IsString()
  @Length(1, 80)
  city!: string;

  @IsIn(TIERS)
  tier!: (typeof TIERS)[number];

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  ownerContactName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  ownerContactPhone?: string;
}
