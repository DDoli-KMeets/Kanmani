import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, inArray, ne, sql } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import type { AssignVenueStaffDto } from "./dto/assign-venue-staff.dto";
import type { DecideKycDto } from "./dto/decide-kyc.dto";
import type { SetStaffRoleDto } from "./dto/set-staff-role.dto";

/**
 * Deliberately plain SQL aggregate queries against Postgres rather than a
 * separate analytics database — build plan §06 flags ClickHouse as
 * premature at Year-1 volume (2,400 meetups/year). These queries stay fast
 * with the indexes already defined in the schema; revisit only if real
 * traffic proves them a bottleneck.
 */
@Injectable()
export class AdminService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async assignVenueStaff(dto: AssignVenueStaffDto) {
    const [venue] = await this.db.select().from(schema.venues).where(eq(schema.venues.id, dto.venueId)).limit(1);
    if (!venue) throw new NotFoundException("Venue not found.");
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, dto.userId)).limit(1);
    if (!user) throw new NotFoundException("User not found.");

    await this.db.insert(schema.venueStaff).values({ venueId: dto.venueId, userId: dto.userId });
    if (user.role === "MEMBER") {
      await this.db.update(schema.users).set({ role: "VENUE_STAFF" }).where(eq(schema.users.id, dto.userId));
    }
    return { venueId: dto.venueId, userId: dto.userId };
  }

  /**
   * Finds a member by their exact phone number so an admin can assign them
   * as venue staff or promote them to Trust & Safety — the only way an
   * admin has to turn a phone number (which is how you'd identify someone
   * in person or over a call) into the user ID those actions need.
   */
  async findUserByPhone(phone: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        phone: schema.users.phone,
        role: schema.users.role,
        accountStatus: schema.users.accountStatus,
      })
      .from(schema.users)
      .where(eq(schema.users.phone, phone))
      .limit(1);
    if (!user) throw new NotFoundException("No K-Meets account with that phone number.");
    return user;
  }

  /**
   * A limited user summary (never gender/DOB/relationship status — those
   * aren't needed to triage a report or assign staff) for the admin
   * dashboard's moderation queue and staff-assignment screens, which
   * otherwise have only raw user IDs to work with. Accepts several IDs at
   * once so a queue of reports can be labelled in one request instead of
   * one per row.
   */
  async getUserSummaries(userIds: string[]) {
    if (userIds.length === 0) return [];
    const rows = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        phone: schema.users.phone,
        role: schema.users.role,
        accountStatus: schema.users.accountStatus,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));
    return rows;
  }

  async setStaffRole(dto: SetStaffRoleDto) {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, dto.userId)).limit(1);
    if (!user) throw new NotFoundException("User not found.");
    const [updated] = await this.db
      .update(schema.users)
      .set({ role: dto.role })
      .where(eq(schema.users.id, dto.userId))
      .returning();
    return updated;
  }

  /**
   * The admin dashboard's KYC review queue (Master Instruction / build plan
   * §2 lists this as a MUST-have for the admin app). Even with the mock KYC
   * provider auto-verifying submissions today, this exists for two real
   * reasons: a real vendor (Digio/Signzy) can come back REJECTED or sit
   * PENDING for hours, and Trust & Safety needs somewhere to see and, in an
   * edge case, manually correct that outcome rather than the member being
   * stuck with no recourse. Defaults to the queue's actual job — anything
   * that still needs a human look — rather than everything ever submitted.
   */
  async listKycQueue(status?: "NOT_STARTED" | "PENDING" | "VERIFIED" | "REJECTED") {
    const rows = await this.db
      .select({
        id: schema.kycVerifications.id,
        userId: schema.kycVerifications.userId,
        userName: schema.users.name,
        userPhone: schema.users.phone,
        provider: schema.kycVerifications.provider,
        status: schema.kycVerifications.status,
        documentType: schema.kycVerifications.documentType,
        submittedAt: schema.kycVerifications.submittedAt,
        decidedAt: schema.kycVerifications.decidedAt,
        rejectionReason: schema.kycVerifications.rejectionReason,
      })
      .from(schema.kycVerifications)
      .innerJoin(schema.users, eq(schema.kycVerifications.userId, schema.users.id))
      .where(status ? eq(schema.kycVerifications.status, status) : ne(schema.kycVerifications.status, "NOT_STARTED"))
      .orderBy(desc(schema.kycVerifications.submittedAt));
    return rows;
  }

  /**
   * Lets Trust & Safety / Super Admin manually set a KYC outcome — the
   * human-in-the-loop escape hatch a review queue exists for. Works
   * regardless of which provider (mock or real) produced the current
   * status, since a person overriding an automated decision is exactly the
   * point.
   */
  async decideKyc(kycId: string, dto: DecideKycDto) {
    if (dto.decision === "REJECTED" && !dto.reason) {
      throw new BadRequestException("A reason is required when rejecting a KYC submission.");
    }
    const [existing] = await this.db.select().from(schema.kycVerifications).where(eq(schema.kycVerifications.id, kycId)).limit(1);
    if (!existing) throw new NotFoundException("KYC submission not found.");

    const [updated] = await this.db
      .update(schema.kycVerifications)
      .set({
        status: dto.decision,
        rejectionReason: dto.decision === "REJECTED" ? dto.reason : null,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.kycVerifications.id, kycId))
      .returning();
    return updated;
  }

  async metrics() {
    const [[userCounts], [verifiedCounts], [bookingCounts], [completedMeetups], [venueCounts], [openReports], [openSos]] =
      await Promise.all([
        this.db.select({ count: sql<number>`count(*)::int` }).from(schema.users),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.kycVerifications)
          .where(eq(schema.kycVerifications.status, "VERIFIED")),
        this.db.select({ count: sql<number>`count(*)::int` }).from(schema.bookings),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.matches)
          .where(eq(schema.matches.status, "REVEALED")),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.venues)
          .where(eq(schema.venues.status, "ACTIVE")),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.reports)
          .where(eq(schema.reports.status, "OPEN")),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.sosAlerts)
          .where(eq(schema.sosAlerts.status, "TRIGGERED")),
      ]);

    return {
      totalUsers: userCounts.count,
      verifiedUsers: verifiedCounts.count,
      totalBookings: bookingCounts.count,
      revealedMeetups: completedMeetups.count,
      activeVenues: venueCounts.count,
      openReports: openReports.count,
      openSosAlerts: openSos.count,
    };
  }
}
