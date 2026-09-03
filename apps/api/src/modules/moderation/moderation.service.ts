import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import type { CreateReportDto } from "./dto/create-report.dto";
import type { ResolveReportDto } from "./dto/resolve-report.dto";

/**
 * The three-strike system from build plan §08/§21 FAQ: warning → 7-day
 * suspension → permanent ban. Every action here is written to the audit
 * log — moderation decisions affecting someone's account must be traceable
 * to who made them and why.
 */
@Injectable()
export class ModerationService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async fileReport(reporterId: string, dto: CreateReportDto) {
    if (dto.reportedUserId === reporterId) {
      throw new BadRequestException("You can't report yourself.");
    }
    const [report] = await this.db
      .insert(schema.reports)
      .values({
        reporterId,
        reportedId: dto.reportedUserId,
        bookingId: dto.bookingId ?? null,
        reason: dto.reason,
        details: dto.details ?? null,
      })
      .returning();
    return report;
  }

  async listQueue(status?: "OPEN" | "INVESTIGATING" | "RESOLVED") {
    if (status) {
      return this.db.select().from(schema.reports).where(eq(schema.reports.status, status));
    }
    return this.db.select().from(schema.reports);
  }

  async resolve(adminId: string, adminRole: string, reportId: string, dto: ResolveReportDto) {
    const [report] = await this.db.select().from(schema.reports).where(eq(schema.reports.id, reportId)).limit(1);
    if (!report) throw new NotFoundException("Report not found.");

    await this.db
      .update(schema.reports)
      .set({
        status: "RESOLVED",
        resolution: dto.resolution,
        handledById: adminId,
        resolvedAt: new Date(),
      })
      .where(eq(schema.reports.id, reportId));

    if (dto.strikeLevel) {
      await this.issueStrike(adminId, report.reportedId, dto.strikeLevel, `Report ${reportId}: ${dto.resolution}`);
    }

    await this.db.insert(schema.adminAuditLog).values({
      actorId: adminId,
      actorRole: adminRole,
      action: "REPORT_RESOLVED",
      entityType: "report",
      entityId: reportId,
      metadata: { strikeLevel: dto.strikeLevel ?? null },
    });

    return { ...report, status: "RESOLVED" as const };
  }

  async issueStrike(
    adminId: string,
    userId: string,
    level: "WARNING" | "SUSPENSION" | "BAN",
    reason: string,
  ) {
    const expiresAt =
      level === "SUSPENSION" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

    await this.db.insert(schema.userStrikes).values({
      userId,
      level,
      reason,
      issuedById: adminId,
      expiresAt,
    });

    if (level === "SUSPENSION") {
      await this.db.update(schema.users).set({ accountStatus: "SUSPENDED" }).where(eq(schema.users.id, userId));
    } else if (level === "BAN") {
      await this.db.update(schema.users).set({ accountStatus: "BANNED" }).where(eq(schema.users.id, userId));
    }
  }
}
