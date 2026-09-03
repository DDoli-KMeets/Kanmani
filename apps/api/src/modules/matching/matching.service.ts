import { Inject, Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import { MATCHING_QUEUE, MATCHING_QUEUE_NAME } from "./matching-queue.provider";
import { PUSH_PROVIDER } from "../../integrations/push/push-provider.interface";
import type { PushProvider } from "../../integrations/push/push-provider.interface";

const MATCH_WINDOW_MINUTES = 30;

/**
 * The core marketplace algorithm: given a newly-payable booking, look for
 * one other booking with overlapping availability at the same venue and
 * score candidates by shared interests. Runs as a background job (see
 * MatchingModule's worker) so booking confirmation is never held up waiting
 * for a match to be found — build plan §05/§09.
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(MATCHING_QUEUE) private readonly queue: Queue,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  async enqueueTryMatch(bookingId: string): Promise<void> {
    await this.queue.add("try-match", { bookingId });
  }

  async tryMatch(bookingId: string): Promise<void> {
    const [booking] = await this.db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);

    if (!booking || booking.status !== "PENDING_MATCH" || booking.format !== "ONE_ON_ONE") {
      return; // Already matched, cancelled, or not a 1-on-1 booking — nothing to do.
    }

    const windowMs = MATCH_WINDOW_MINUTES * 60 * 1000;
    const windowStart = new Date(booking.slotDate.getTime() - windowMs);
    const windowEnd = new Date(booking.slotDate.getTime() + windowMs);

    const candidates = await this.db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.venueId, booking.venueId),
          eq(schema.bookings.format, "ONE_ON_ONE"),
          eq(schema.bookings.status, "PENDING_MATCH"),
          ne(schema.bookings.userId, booking.userId),
          gte(schema.bookings.slotDate, windowStart),
          lte(schema.bookings.slotDate, windowEnd),
        ),
      );

    if (candidates.length === 0) {
      this.logger.log(`No match yet for booking ${bookingId} — will match when a candidate appears.`);
      return;
    }

    const scored = await Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        score: await this.interestOverlapScore(booking.userId, candidate.userId),
      })),
    );
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Deterministic ordering (lexicographically smaller booking id first) so
    // the unique index on (bookingAId) / (bookingBId) never collides
    // regardless of which side's job runs the match.
    const [bookingAId, bookingBId] =
      booking.id < best.candidate.id ? [booking.id, best.candidate.id] : [best.candidate.id, booking.id];

    await this.db.transaction(async (tx) => {
      // Re-check inside the transaction: another worker may have matched
      // one of these bookings between our SELECT above and now.
      const stillPending = await tx
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(
          and(
            inArray(schema.bookings.id, [bookingAId, bookingBId]),
            eq(schema.bookings.status, "PENDING_MATCH"),
          ),
        );
      if (stillPending.length !== 2) return;

      await tx.insert(schema.matches).values({
        bookingAId,
        bookingBId,
        matchScore: best.score,
        status: "CONFIRMED",
      });

      await tx
        .update(schema.bookings)
        .set({ status: "MATCHED", updatedAt: new Date() })
        .where(inArray(schema.bookings.id, [bookingAId, bookingBId]));
    });

    await this.push.send({
      userId: booking.userId,
      title: "You've been matched!",
      body: "Check the app for your meetup details.",
    });
    await this.push.send({
      userId: best.candidate.userId,
      title: "You've been matched!",
      body: "Check the app for your meetup details.",
    });

    this.logger.log(`Matched bookings ${bookingAId} and ${bookingBId} (score ${best.score}).`);
  }

  private async interestOverlapScore(userIdA: string, userIdB: string): Promise<number> {
    // Each user has at most 5 interests (enforced in UpdateProfileDto), so
    // pulling both sets and intersecting in memory is simpler and just as
    // fast as a SQL-side intersection at this scale.
    const [interestsA, interestsB] = await Promise.all([
      this.db
        .select({ interestId: schema.userInterests.interestId })
        .from(schema.userInterests)
        .where(eq(schema.userInterests.userId, userIdA)),
      this.db
        .select({ interestId: schema.userInterests.interestId })
        .from(schema.userInterests)
        .where(eq(schema.userInterests.userId, userIdB)),
    ]);

    const setB = new Set(interestsB.map((i) => i.interestId));
    return interestsA.filter((i) => setB.has(i.interestId)).length;
  }
}

export { MATCHING_QUEUE_NAME };
