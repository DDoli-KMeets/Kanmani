import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@kmeets/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { VenuesService } from "./venues.service";
import { CreateVenueDto } from "./dto/create-venue.dto";

@Controller({ path: "venues", version: "1" })
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query("city") city?: string, @Query("tier") tier?: string) {
    return this.venues.listActive(city, tier);
  }

  /**
   * Which venues the signed-in staff member works at (or every active
   * venue, for an admin) — what the staff dashboard uses to build its venue
   * picker, since a staff account otherwise has no way to discover its own
   * assignment. Declared before ":id" so "mine" isn't swallowed by that
   * route.
   */
  @Get("mine")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENUE_STAFF, UserRole.SUPER_ADMIN)
  listMine(@CurrentUser() user: AuthenticatedUser) {
    if (user.role === "SUPER_ADMIN") {
      return this.venues.listAll();
    }
    return this.venues.listForStaff(user.userId);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  getOne(@Param("id") id: string) {
    return this.venues.getById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateVenueDto) {
    return this.venues.create(dto);
  }

  @Patch(":id/cctv-verify")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.TRUST_AND_SAFETY)
  verifyCctv(@Param("id") id: string) {
    return this.venues.markCctvVerified(id);
  }
}
