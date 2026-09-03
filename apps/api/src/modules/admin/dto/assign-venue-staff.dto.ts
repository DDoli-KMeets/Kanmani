import { IsUUID } from "class-validator";

export class AssignVenueStaffDto {
  @IsUUID()
  venueId!: string;

  @IsUUID()
  userId!: string;
}
