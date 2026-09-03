import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { VenueTier } from "@kmeets/shared";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import type { CreateVenueDto } from "./dto/create-venue.dto";

const VALID_TIERS: readonly string[] = Object.values(VenueTier);

@Injectable()
export class VenuesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(dto: CreateVenueDto) {
    const [venue] = await this.db
      .insert(schema.venues)
      .values({ ...dto, status: "PENDING_ONBOARDING" })
      .returning();
    return venue;
  }

  /** CCTV verification is a manual admin action (a real person confirms it on an onboarding visit) — see build plan §08. */
  async markCctvVerified(venueId: string) {
    await this.requireVenue(venueId);
    const [updated] = await this.db
      .update(schema.venues)
      .set({ cctvVerifiedAt: new Date(), status: "ACTIVE", updatedAt: new Date() })
      .where(eq(schema.venues.id, venueId))
      .returning();
    return updated;
  }

  async listActive(city?: string, tier?: string) {
    const conditions = [eq(schema.venues.status, "ACTIVE")];
    if (city) conditions.push(eq(schema.venues.city, city));
    // `tier` arrives as a raw query string, not a validated DTO field, so we
    // check it against the real enum ourselves rather than trusting it —
    // an unrecognised value is silently ignored rather than reaching the
    // database as an invalid enum cast.
    if (tier && VALID_TIERS.includes(tier)) {
      conditions.push(eq(schema.venues.tier, tier as VenueTier));
    }

    return this.db
      .select()
      .from(schema.venues)
      .where(and(...conditions));
  }

  async getById(venueId: string) {
    return this.requireVenue(venueId);
  }

  /**
   * Every venue regardless of status — including ones an admin just
   * created that are still PENDING_ONBOARDING — so an admin can find and
   * CCTV-verify a new venue. listActive() (used for member browsing)
   * deliberately excludes those; this is the admin-only counterpart.
   */
  async listAll() {
    return this.db.select().from(schema.venues);
  }

  /** Venues a given staff member is assigned to work at — see VenuesController.listMine. */
  async listForStaff(userId: string) {
    const rows = await this.db
      .select({ venue: schema.venues })
      .from(schema.venueStaff)
      .innerJoin(schema.venues, eq(schema.venueStaff.venueId, schema.venues.id))
      .where(eq(schema.venueStaff.userId, userId));
    return rows.map((r) => r.venue);
  }

  private async requireVenue(venueId: string) {
    const [venue] = await this.db.select().from(schema.venues).where(eq(schema.venues.id, venueId)).limit(1);
    if (!venue) throw new NotFoundException("Venue not found.");
    return venue;
  }
}
