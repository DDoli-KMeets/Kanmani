import { IsIn, IsOptional, IsString, Length } from "class-validator";

const STRIKE_LEVELS = ["WARNING", "SUSPENSION", "BAN"] as const;

export class ResolveReportDto {
  @IsString()
  @Length(1, 2000)
  resolution!: string;

  @IsOptional()
  @IsIn(STRIKE_LEVELS)
  strikeLevel?: (typeof STRIKE_LEVELS)[number];
}
