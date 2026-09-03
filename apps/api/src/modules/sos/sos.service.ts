import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import { PUSH_PROVIDER } from "../../integrations/push/push-provider.interface";
import type { PushProvider } from "../../integrations/push/push-provider.interface";
import type { TriggerSosDto } from "./dto/trigger-sos.dto";

/**
 * The safety-critical path of the whole app (build plan §04 journey D /
 * §08 layer 4). One tap alerts venue staff and the K-Meets safety on-call
 * simultaneously. This endpoint deliberately has NO rate limit and NO KYC
 * gate beyond being signed in — nothing should ever be able to slow someone
 * down from pressing this button.
 */
@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  async trigger(userId: string, dto: TriggerSosDto) {
    let venueId: string | null = null;
    let bookingId: string | null = null;
    if (dto.bookingId) {
      const [booking] = await this.db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, dto.bookingId))
        .limit(1);
      // A bookingId that doesn't belong to the person pressing the button
      // is silently dropped rather than trusted — this is the one endpoint
      // in the app that must never reject an honest call for help, so a
      // bogus/someone-else's bookingId still raises a real, untied alert
      // instead of a 403, but it stops short of letting it page a venue
      // (or attach another member's booking details) it has nothing to do
      // with.
      if (booking && booking.userId === userId) {
        venueId = booking.venueId;
        bookingId = booking.id;
      } else if (booking) {
        this.logger.warn(
          `SOS trigger from user ${userId} referenced a bookingId it doesn't own — ignoring the booking/venue link.`,
        );
      }
    }

    const [alert] = await this.db
      .insert(schema.sosAlerts)
      .values({ bookingId, userId, venueId })
      .returning();

    this.logger.warn(`SOS TRIGGERED — alert ${alert.id}, user ${userId}, venue ${venueId ?? "unknown"}`);

    if (venueId) {
      const staff = await this.db
        .select()
        .from(schema.venueStaff)
        .where(eq(schema.venueStaff.venueId, venueId));
      await Promise.all(
        staff.map((s) =>
          this.push.send({
            userId: s.userId,
            title: "SOS ALERT",
            body: "A member at your venue needs help right now.",
            data: { alertId: alert.id },
          }),
        ),
      );
    }
    // Real deployments also page an on-call safety contact here (e.g. via
    // an SMS/voice escalation service) — not implemented against a real
    // provider yet since no such vendor account exists (see build plan §12).

    return alert;
  }

  async acknowledge(staffUserId: string, staffRole: string, alertId: string) {
    const alert = await this.requireAlert(alertId);
    await this.requireCanHandle(staffUserId, staffRole, alert);
    const [updated] = await this.db
      .update(schema.sosAlerts)
      .set({ status: "ACKNOWLEDGED", acknowledgedAt: new Date() })
      .where(eq(schema.sosAlerts.id, alertId))
      .returning();
    return updated;
  }

  async resolve(staffUserId: string, staffRole: string, alertId: string, notes?: string) {
    const alert = await this.requireAlert(alertId);
    await this.requireCanHandle(staffUserId, staffRole, alert);
    const resolvedAt = new Date();
    const responseTimeSeconds = Math.round(
      (resolvedAt.getTime() - alert.triggeredAt.getTime()) / 1000,
    );

    const [updated] = await this.db
      .update(schema.sosAlerts)
      .set({ status: "RESOLVED", resolvedAt, responseTimeSeconds, notes: notes ?? null })
      .where(eq(schema.sosAlerts.id, alertId))
      .returning();
    return updated;
  }

  /**
   * Trust & Safety and Super Admins are the platform-wide safety-response
   * team and see/handle every alert, by design. Venue staff are scoped to
   * their own venue — this is the same principle as checkins.service's
   * isStaffAtVenue check, applied here so a compromised or malicious
   * venue-staff account at one café can't see or silently mark "resolved"
   * an in-progress emergency at an unrelated venue.
   */
  async listOpen(staffUserId: string, staffRole: string) {
    if (staffRole !== "VENUE_STAFF") {
      return this.db.select().from(schema.sosAlerts);
    }
    const myVenueIds = await this.staffVenueIds(staffUserId);
    if (myVenueIds.length === 0) return [];
    return this.db.select().from(schema.sosAlerts).where(inArray(schema.sosAlerts.venueId, myVenueIds));
  }

  private async requireCanHandle(
    staffUserId: string,
    staffRole: string,
    alert: { venueId: string | null },
  ): Promise<void> {
    if (staffRole !== "VENUE_STAFF") return; // Trust & Safety / Super Admin: unrestricted.
    if (!alert.venueId) {
      // An alert with no venue attached (no bookingId, or one that didn't
      // check out — see trigger() above) has no venue for a venue-staff
      // account to be "the staff of", so only the platform-wide safety
      // team can handle it.
      throw new ForbiddenException("Only Trust & Safety can handle an alert with no venue attached.");
    }
    const myVenueIds = await this.staffVenueIds(staffUserId);
    if (!myVenueIds.includes(alert.venueId)) {
      throw new ForbiddenException("You can only handle SOS alerts at your own venue.");
    }
  }

  private async staffVenueIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ venueId: schema.venueStaff.venueId })
      .from(schema.venueStaff)
      .where(eq(schema.venueStaff.userId, userId));
    return rows.map((r) => r.venueId);
  }

  private async requireAlert(alertId: string) {
    const [alert] = await this.db.select().from(schema.sosAlerts).where(eq(schema.sosAlerts.id, alertId)).limit(1);
    if (!alert) throw new NotFoundException("SOS alert not found.");
    return alert;
  }
}
