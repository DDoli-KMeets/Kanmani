import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, or } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";

@Injectable()
export class CheckinsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Confirms a member has physically arrived at the venue. This is the ONLY
   * action that can lead to an identity reveal, and it can only be
   * performed by staff of THAT booking's venue (or a super admin) — never
   * by the member themselves, and never for a venue they don't work at.
   * See build plan §08 "Identity reveal".
   */
  async confirmCheckin(staffUserId: string, staffRole: string, bookingId: string) {
    const [booking] = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);
    if (!booking) throw new NotFoundException("Booking not found.");

    if (staffRole !== "SUPER_ADMIN") {
      const isStaffHere = await this.isStaffAtVenue(staffUserId, booking.venueId);
      if (!isStaffHere) {
        throw new ForbiddenException("You can only check members in at your own venue.");
      }
    }

    if (booking.status !== "MATCHED" && booking.status !== "CONFIRMED") {
      throw new BadRequestException(
        `This booking is ${booking.status.toLowerCase().replace("_", " ")} and can't be checked in.`,
      );
    }

    const [existingCheckin] = await this.db
      .select()
      .from(schema.checkins)
      .where(eq(schema.checkins.bookingId, bookingId))
      .limit(1);
    if (existingCheckin) {
      throw new BadRequestException("This member has already been checked in.");
    }

    await this.db.insert(schema.checkins).values({ bookingId, confirmedById: staffUserId });
    await this.db
      .update(schema.bookings)
      .set({ status: "CHECKED_IN", updatedAt: new Date() })
      .where(eq(schema.bookings.id, bookingId));

    const revealed = await this.revealIfBothCheckedIn(bookingId);

    await this.db.insert(schema.adminAuditLog).values({
      actorId: staffUserId,
      actorRole: staffRole,
      action: "CHECKIN_CONFIRMED",
      entityType: "booking",
      entityId: bookingId,
      metadata: { revealed },
    });

    return { bookingId, revealed };
  }

  /**
   * The staff dashboard's "who's expected" roster for one venue: every
   * booking that's been matched and is waiting on (or mid-way through)
   * check-in, ordered by slot time. Deliberately doesn't include a
   * member's name — staff identify who's in front of them by the booking
   * reference the member reads off their own app, not by browsing names,
   * which would defeat the same anonymity boundary the reveal flow
   * protects everywhere else.
   */
  async listUpcomingForVenue(staffUserId: string, staffRole: string, venueId: string) {
    if (staffRole !== "SUPER_ADMIN") {
      const isStaffHere = await this.isStaffAtVenue(staffUserId, venueId);
      if (!isStaffHere) {
        throw new ForbiddenException("You can only view bookings at your own venue.");
      }
    }

    const bookings = await this.db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.venueId, venueId),
          inArray(schema.bookings.status, ["MATCHED", "CONFIRMED", "CHECKED_IN"]),
        ),
      );

    const checkins = await this.db
      .select()
      .from(schema.checkins)
      .where(
        inArray(
          schema.checkins.bookingId,
          bookings.map((b) => b.id),
        ),
      );
    const checkedInIds = new Set(checkins.map((c) => c.bookingId));

    return bookings
      .map((b) => ({
        id: b.id,
        reference: b.id.slice(0, 8).toUpperCase(),
        slotDate: b.slotDate,
        format: b.format,
        status: b.status,
        checkedIn: checkedInIds.has(b.id),
      }))
      .sort((a, b) => a.slotDate.getTime() - b.slotDate.getTime());
  }

  private async revealIfBothCheckedIn(bookingId: string): Promise<boolean> {
    const [match] = await this.db
      .select()
      .from(schema.matches)
      .where(or(eq(schema.matches.bookingAId, bookingId), eq(schema.matches.bookingBId, bookingId)));
    if (!match) return false;

    const counterpartId = match.bookingAId === bookingId ? match.bookingBId : match.bookingAId;
    const [counterpartCheckin] = await this.db
      .select()
      .from(schema.checkins)
      .where(eq(schema.checkins.bookingId, counterpartId))
      .limit(1);

    if (!counterpartCheckin) return false;

    await this.db
      .update(schema.matches)
      .set({ status: "REVEALED", revealedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.matches.id, match.id));

    return true;
  }

  private async isStaffAtVenue(userId: string, venueId: string): Promise<boolean> {
    const [assignment] = await this.db
      .select({ id: schema.venueStaff.id })
      .from(schema.venueStaff)
      .where(and(eq(schema.venueStaff.userId, userId), eq(schema.venueStaff.venueId, venueId)))
      .limit(1);
    return Boolean(assignment);
  }
}
