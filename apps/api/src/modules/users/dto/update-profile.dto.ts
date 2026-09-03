import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from "class-validator";

const GENDERS = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;
const RELATIONSHIP_STATUSES = [
  "SINGLE",
  "IN_A_RELATIONSHIP",
  "MARRIED",
  "PREFER_NOT_TO_SAY",
] as const;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: (typeof GENDERS)[number];

  @IsOptional()
  @IsIn(RELATIONSHIP_STATUSES)
  relationshipStatus?: (typeof RELATIONSHIP_STATUSES)[number];

  @IsOptional()
  @IsString()
  @Length(0, 500)
  bio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5) // "up to 5 interests" — build plan §02
  @IsUUID(undefined, { each: true })
  interestIds?: string[];
}
