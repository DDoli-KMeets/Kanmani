import { IsIn, IsUUID } from "class-validator";

export class SetStaffRoleDto {
  @IsUUID()
  userId!: string;

  @IsIn(["TRUST_AND_SAFETY", "SUPER_ADMIN"])
  role!: "TRUST_AND_SAFETY" | "SUPER_ADMIN";
}
