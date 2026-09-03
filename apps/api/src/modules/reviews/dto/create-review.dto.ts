import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from "class-validator";

export class CreateReviewDto {
  @IsUUID()
  bookingId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  wantsToConnect?: boolean;
}
