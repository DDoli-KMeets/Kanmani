import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@kmeets/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CheckinsService } from "./checkins.service";

@Controller({ path: "checkins", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENUE_STAFF, UserRole.SUPER_ADMIN)
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Get("venue/:venueId")
  listForVenue(@CurrentUser() user: AuthenticatedUser, @Param("venueId") venueId: string) {
    return this.checkins.listUpcomingForVenue(user.userId, user.role, venueId);
  }

  @Post(":bookingId")
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() user: AuthenticatedUser, @Param("bookingId") bookingId: string) {
    return this.checkins.confirmCheckin(user.userId, user.role, bookingId);
  }
}
