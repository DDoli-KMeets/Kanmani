import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@kmeets/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/create-event.dto";

@Controller({ path: "events", version: "1" })
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.listUpcoming();
  }

  @Get("mine/rsvps")
  myRsvps(@CurrentUser() user: AuthenticatedUser) {
    return this.events.listMyRsvps(user.userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateEventDto) {
    return this.events.create(dto);
  }

  @Post(":id/rsvp")
  rsvp(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.events.rsvp(user.userId, id);
  }

  @Delete(":id/rsvp")
  cancelRsvp(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.events.cancelRsvp(user.userId, id);
  }
}
