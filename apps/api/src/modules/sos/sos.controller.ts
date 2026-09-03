import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@kmeets/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { SosService } from "./sos.service";
import { TriggerSosDto } from "./dto/trigger-sos.dto";

@Controller({ path: "sos", version: "1" })
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(private readonly sos: SosService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  trigger(@CurrentUser() user: AuthenticatedUser, @Body() dto: TriggerSosDto) {
    return this.sos.trigger(user.userId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENUE_STAFF, UserRole.TRUST_AND_SAFETY, UserRole.SUPER_ADMIN)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sos.listOpen(user.userId, user.role);
  }

  @Patch(":id/acknowledge")
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENUE_STAFF, UserRole.TRUST_AND_SAFETY, UserRole.SUPER_ADMIN)
  acknowledge(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.sos.acknowledge(user.userId, user.role, id);
  }

  @Patch(":id/resolve")
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENUE_STAFF, UserRole.TRUST_AND_SAFETY, UserRole.SUPER_ADMIN)
  resolve(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body("notes") notes?: string) {
    return this.sos.resolve(user.userId, user.role, id, notes);
  }
}
