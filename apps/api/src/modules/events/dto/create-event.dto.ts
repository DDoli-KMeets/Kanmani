import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from "class-validator";

const EVENT_TYPES = ["trip", "trail_run", "farm_day", "other"] as const;

export class CreateEventDto {
  @IsString()
  @Length(1, 160)
  title!: string;

  @IsString()
  @Length(1, 2000)
  description!: string;

  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  locationText?: string;

  @IsDateString()
  startsAt!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsInt()
  @Min(0)
  priceRupees!: number;

  @IsIn(EVENT_TYPES)
  eventType!: (typeof EVENT_TYPES)[number];
}
