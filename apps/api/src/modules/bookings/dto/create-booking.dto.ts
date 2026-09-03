import { IsDateString, IsIn, IsUUID } from "class-validator";

export class CreateBookingDto {
  @IsUUID()
  venueId!: string;

  @IsDateString()
  slotDate!: string;

  @IsIn(["ONE_ON_ONE", "GROUP"])
  format!: "ONE_ON_ONE" | "GROUP";
}
