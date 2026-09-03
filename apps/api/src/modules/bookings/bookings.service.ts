import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq, or } from "drizzle-orm";
import { MIN_AGE_YEARS, calculateAge } from "@kmeets/shared";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import { KycService } from "../kyc/kyc.service";
import { PaymentsService } from "../payments/payments.service";
import { priceForTierPaise } from "./pricing";
import { toPreRevealProfile, toRevealedProfile } from "../../common/profile-view";
import type { CreateBookingDto } from "./dto/create-booking.dto";

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly kyc: KycService,
    private readonly payments: PaymentsService,
  ) {}

  async createBooking(userId: string, dto: CreateBookingDto) {
    if (!(await this.kyc.isVerified(userId))) {
      // The single most important gate in the product: nobody books a
      // meetup without a verified identity — build plan §02/§08.
      throw new ForbiddenException("Complete Video KYC before booking a meetup.");
    }

    // UsersService only checks the 18+ rule when a profile update happens
    // to include a dateOfBirth — a profile that never set one (or that
    // was created before this field existed) would otherwise sail past
    // that check entirely. This is the actual point of no return (real
    // money, a real in-person meetup with a stranger), so it gets its own
    // server-side gate rather than trusting that the earlier one always ran.
    const [profile] = await this.db
      .select({ dateOfBirth: schema.users.dateOfBirth })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!profile?.dateOfBirth || calculateAge(profile.dateOfBirth) < MIN_AGE_YEARS) {
      throw new ForbiddenException("Complete your profile with a valid date of birth before booking.");
    }

    const [venue] = await this.db
      .select()
      .from(schema.venues)
      .where(eq(schema.venues.id, dto.venueId))
      .limit(1);
    if (!venue || venue.status !== "ACTIVE") {
      throw new BadRequestException("This venue isn't accepting bookings right now.");
    }

    const slotDate = new Date(dto.slotDate);
    if (slotDate.getTime() < Date.now()) {
      throw new BadRequestException("Pick a time slot in the future.");
    }

    const pricePaidPaise = priceForTierPaise(venue.tier);

    const [booking] = await this.db
      .insert(schema.bookings)
      .values({
        userId,
        venueId: dto.venueId,
        slotDate,
        format: dto.format,
        pricePaidPaise,
      })
      .returning();

    const payment = await this.payments.createOrderForBooking(userId, booking.id, pricePaidPaise);

    return { booking, payment };
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.requireOwnedBooking(userId, bookingId);
    if (booking.status === "COMPLETED" || booking.status === "CHECKED_IN") {
      throw new BadRequestException("This meetup has already happened and can't be cancelled.");
    }

    await this.db
      .update(schema.bookings)
      .set({ status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.bookings.id, bookingId));

    return { ...booking, status: "CANCELLED" as const };
  }

  async listMyBookings(userId: string) {
    const rows = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.userId, userId));

    return Promise.all(rows.map((booking) => this.attachMatchView(userId, booking)));
  }

  async getMyBooking(userId: string, bookingId: string) {
    const booking = await this.requireOwnedBooking(userId, bookingId);
    return this.attachMatchView(userId, booking);
  }

  /**
   * The anonymity boundary in action: looks up the match for this booking
   * (if any) and returns the counterpart's PRE-REVEAL profile, unless a
   * Checkin row exists for BOTH sides — in which case it returns the full
   * REVEALED profile. This is the only place the other party's data is
   * attached to a booking response, so it's the only place that rule needs
   * to be right.
   */
  private async attachMatchView(userId: string, booking: typeof schema.bookings.$inferSelect) {
    // Shown to the member as a short code to read out to venue staff at
    // check-in, since staff otherwise have no way to tell which of several
    // arriving members a given booking belongs to without seeing a name —
    // matching the same identity-hidden-by-default approach used
    // everywhere else (see CheckinsService.listUpcomingForVenue).
    const reference = booking.id.slice(0, 8).toUpperCase();

    const [match] = await this.db
      .select()
      .from(schema.matches)
      .where(or(eq(schema.matches.bookingAId, booking.id), eq(schema.matches.bookingBId, booking.id)));

    if (!match) return { ...booking, reference, match: null };

    const counterpartBookingId = match.bookingAId === booking.id ? match.bookingBId : match.bookingAId;
    const [counterpartBooking] = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, counterpartBookingId))
      .limit(1);

    const [myCheckin] = await this.db
      .select()
      .from(schema.checkins)
      .where(eq(schema.checkins.bookingId, booking.id))
      .limit(1);
    const [theirCheckin] = await this.db
      .select()
      .from(schema.checkins)
      .where(eq(schema.checkins.bookingId, counterpartBookingId))
      .limit(1);

    const [counterpartUser] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, counterpartBooking.userId))
      .limit(1);

    const revealed = Boolean(myCheckin && theirCheckin);
    const counterpart = revealed
      ? toRevealedProfile(counterpartUser)
      : toPreRevealProfile(counterpartUser);

    return {
      ...booking,
      reference,
      match: {
        id: match.id,
        status: revealed ? "REVEALED" : match.status,
        revealed,
        counterpart,
      },
    };
  }

  private async requireOwnedBooking(userId: string, bookingId: string) {
    const [booking] = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException("Booking not found.");
    // The core IDOR check for this whole module: a booking is only ever
    // visible to the member who made it (venue staff/admin use a separate,
    // separately-authorized path — see CheckinsService).
    if (booking.userId !== userId) {
      throw new ForbiddenException("This isn't your booking.");
    }
    return booking;
  }
}
