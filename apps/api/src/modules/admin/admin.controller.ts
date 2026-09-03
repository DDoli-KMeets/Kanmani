import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@kmeets/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AdminService } from "./admin.service";
import { AssignVenueStaffDto } from "./dto/assign-venue-staff.dto";
import { DecideKycDto } from "./dto/decide-kyc.dto";
import { LookupUsersDto } from "./dto/lookup-users.dto";
import { SetStaffRoleDto } from "./dto/set-staff-role.dto";

@Controller({ path: "admin", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("metrics")
  @Roles(UserRole.SUPER_ADMIN, UserRole.TRUST_AND_SAFETY)
  metrics() {
    return this.admin.metrics();
  }

  @Post("users/lookup")
  @Roles(UserRole.SUPER_ADMIN, UserRole.TRUST_AND_SAFETY)
  lookupUsers(@Body() dto: LookupUsersDto) {
    return this.admin.getUserSummaries(dto.userIds);
  }

  @Get("users/by-phone")
  @Roles(UserRole.SUPER_ADMIN)
  findByPhone(@Query("phone") phone: string) {
    return this.admin.findUserByPhone(phone);
  }

  @Post("venue-staff")
  @Roles(UserRole.SUPER_ADMIN)
  assignVenueStaff(@Body() dto: AssignVenueStaffDto) {
    return this.admin.assignVenueStaff(dto);
  }

  @Post("staff-role")
  @Roles(UserRole.SUPER_ADMIN)
  setStaffRole(@Body() dto: SetStaffRoleDto) {
    return this.admin.setStaffRole(dto);
  }

  @Get("kyc")
  @Roles(UserRole.SUPER_ADMIN, UserRole.TRUST_AND_SAFETY)
  kycQueue(@Query("status") status?: "NOT_STARTED" | "PENDING" | "VERIFIED" | "REJECTED") {
    return this.admin.listKycQueue(status);
  }

  @Patch("kyc/:id/decide")
  @Roles(UserRole.SUPER_ADMIN, UserRole.TRUST_AND_SAFETY)
  decideKyc(@Param("id") id: string, @Body() dto: DecideKycDto) {
    return this.admin.decideKyc(id, dto);
  }
}
