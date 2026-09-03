import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gte, inArray } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import { PaymentsService } from "../payments/payments.service";
import type { CreateEventDto } from "./dto/create-event.dto";

@Injectable()
export class EventsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly payments: PaymentsService,
  ) {}

  async create(dto: CreateEventDto) {
    const [event] = await this.db
      .insert(schema.communityEvents)
      .values({ ...dto, startsAt: new Date(dto.startsAt) })
      .returning();
    return event;
  }

  async listUpcoming() {
    return this.db
      .select()
      .from(schema.communityEvents)
      .where(gte(schema.communityEvents.startsAt, new Date()));
  }

  async rsvp(userId: string, eventId: string) {
    const [event] = await this.db
      .select()
      .from(schema.communityEvents)
      .where(eq(schema.communityEvents.id, eventId))
      .limit(1);
    if (!event) throw new NotFoundException("Event not found.");

    const [existing] = await this.db
      .select()
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, userId)))
      .limit(1);
    if (existing) {
      throw new BadRequestException("You've already RSVP'd to this event.");
    }

    const confirmedCount = await this.db
      .select({ id: schema.eventRsvps.id })
      .from(schema.eventRsvps)
      .where(
        and(
          eq(schema.eventRsvps.eventId, eventId),
          inArray(schema.eventRsvps.status, ["REGISTERED", "ATTENDED"]),
        ),
      );

    const status = confirmedCount.length >= event.capacity ? "WAITLIST" : "REGISTERED";

    const [rsvp] = await this.db
      .insert(schema.eventRsvps)
      .values({ eventId, userId, status })
      .returning();

    if (status === "WAITLIST" || event.priceRupees === 0) {
      return { rsvp, payment: null };
    }

    const payment = await this.payments.createOrderForEventRsvp(
      userId,
      rsvp.id,
      event.priceRupees * 100,
    );
    return { rsvp, payment };
  }

  async cancelRsvp(userId: string, eventId: string) {
    const [rsvp] = await this.db
      .select()
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, userId)))
      .limit(1);
    if (!rsvp) throw new NotFoundException("You don't have an RSVP for this event.");
    if (rsvp.userId !== userId) throw new ForbiddenException("This isn't your RSVP.");

    await this.db
      .update(schema.eventRsvps)
      .set({ status: "CANCELLED" })
      .where(eq(schema.eventRsvps.id, rsvp.id));

    return { ...rsvp, status: "CANCELLED" as const };
  }

  async listMyRsvps(userId: string) {
    return this.db.select().from(schema.eventRsvps).where(eq(schema.eventRsvps.userId, userId));
  }
}
