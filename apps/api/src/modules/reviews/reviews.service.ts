import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, or } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import type { CreateReviewDto } from "./dto/create-review.dto";

@Injectable()
export class ReviewsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createForBooking(userId: string, dto: CreateReviewDto) {
    const booking = await this.requireOwnedBooking(userId, dto.bookingId);
    const counterpartBooking = await this.counterpartBookingFor(booking.id);

    const values = {
      bookingId: booking.id,
      reviewerId: userId,
      revieweeId: counterpartBooking?.userId ?? null,
      venueId: booking.venueId,
      rating: dto.rating,
      comment: dto.comment ?? null,
      wantsToConnect: dto.wantsToConnect ?? false,
    };

    // One review per person per booking (schema's reviews_booking_reviewer_unique)
    // — resubmitting updates the existing row instead of adding a second
    // one, so re-reviewing to change a "stay connected" answer works, and
    // getConnectionStatus never has to guess which of several rows is current.
    const [review] = await this.db
      .insert(schema.reviews)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.reviews.bookingId, schema.reviews.reviewerId],
        set: {
          rating: values.rating,
          comment: values.comment,
          wantsToConnect: values.wantsToConnect,
        },
      })
      .returning();

    return review;
  }

  async myReceivedReviews(userId: string) {
    return this.db.select().from(schema.reviews).where(eq(schema.reviews.revieweeId, userId));
  }

  /**
   * "optionally stay connected" (build plan §1/§2). Never reveals a phone
   * number or opens messaging — just tells each side whether the other
   * also opted in, the same "only once both sides agree" shape as the
   * check-in reveal, so neither side's answer is visible to the other
   * until both have actually answered.
   */
  async getConnectionStatus(userId: string, bookingId: string) {
    const booking = await this.requireOwnedBooking(userId, bookingId);

    const [myReview] = await this.db
      .select()
      .from(schema.reviews)
      .where(and(eq(schema.reviews.bookingId, booking.id), eq(schema.reviews.reviewerId, userId)))
      .limit(1);

    const counterpartBooking = await this.counterpartBookingFor(booking.id);
    const counterpartReview = counterpartBooking
      ? (
          await this.db
            .select()
            .from(schema.reviews)
            .where(
              and(
                eq(schema.reviews.bookingId, counterpartBooking.id),
                eq(schema.reviews.reviewerId, counterpartBooking.userId),
              ),
            )
            .limit(1)
        )[0]
      : null;

    const iWantToConnect = myReview?.wantsToConnect ?? false;
    const counterpartHasReviewed = !!counterpartReview;
    const mutual = iWantToConnect && (counterpartReview?.wantsToConnect ?? false);

    return {
      iHaveReviewed: !!myReview,
      iWantToConnect,
      counterpartHasReviewed,
      mutual,
    };
  }

  private async requireOwnedBooking(userId: string, bookingId: string) {
    const [booking] = await this.db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)).limit(1);
    if (!booking) throw new NotFoundException("Booking not found.");
    if (booking.userId !== userId) throw new ForbiddenException("This isn't your booking.");
    if (booking.status !== "CHECKED_IN" && booking.status !== "COMPLETED") {
      throw new BadRequestException("You can only review a meetup you actually attended.");
    }
    return booking;
  }

  private async counterpartBookingFor(bookingId: string) {
    const [match] = await this.db
      .select()
      .from(schema.matches)
      .where(or(eq(schema.matches.bookingAId, bookingId), eq(schema.matches.bookingBId, bookingId)));
    if (!match) return null;

    const counterpartBookingId = match.bookingAId === bookingId ? match.bookingBId : match.bookingAId;
    const [counterpartBooking] = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, counterpartBookingId))
      .limit(1);
    return counterpartBooking ?? null;
  }
}
