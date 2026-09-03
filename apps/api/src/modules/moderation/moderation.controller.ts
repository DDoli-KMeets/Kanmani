import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@kmeets/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ModerationService } from "./moderation.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { ResolveReportDto } from "./dto/resolve-report.dto";

@Controller({ path: "reports", version: "1" })
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  file(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.moderation.fileReport(user.userId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.TRUST_AND_SAFETY, UserRole.SUPER_ADMIN)
  queue(@Query("status") status?: "OPEN" | "INVESTIGATING" | "RESOLVED") {
    return this.moderation.listQueue(status);
  }

  @Patch(":id/resolve")
  @UseGuards(RolesGuard)
  @Roles(UserRole.TRUST_AND_SAFETY, UserRole.SUPER_ADMIN)
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.moderation.resolve(user.userId, user.role, id, dto);
  }
}
