import { IsOptional, IsUUID } from "class-validator";

export class TriggerSosDto {
  @IsOptional()
  @IsUUID()
  bookingId?: string;
}
