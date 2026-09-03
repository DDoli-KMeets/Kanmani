import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { MIN_AGE_YEARS, calculateAge } from "@kmeets/shared";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getProfile(userId: string) {
    const user = await this.requireUser(userId);
    const interestRows = await this.db
      .select({ interest: schema.interests })
      .from(schema.userInterests)
      .innerJoin(schema.interests, eq(schema.userInterests.interestId, schema.interests.id))
      .where(eq(schema.userInterests.userId, userId));

    const { deletedAt: _deletedAt, ...safeUser } = user;
    return { ...safeUser, interests: interestRows.map((r) => r.interest) };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.requireUser(userId);

    if (dto.dateOfBirth) {
      const age = calculateAge(new Date(dto.dateOfBirth));
      if (age < MIN_AGE_YEARS) {
        // K-Meets is an adults-only platform by design (in-person meetups
        // with strangers). This is enforced here, server-side, not just
        // with a date picker's min-date in the app.
        throw new BadRequestException("You must be 18 or older to use K-Meets.");
      }
    }

    const { interestIds, ...profileFields } = dto;

    await this.db
      .update(schema.users)
      .set({
        ...(profileFields.name !== undefined ? { name: profileFields.name } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        ...(profileFields.gender !== undefined ? { gender: profileFields.gender } : {}),
        ...(profileFields.relationshipStatus !== undefined
          ? { relationshipStatus: profileFields.relationshipStatus }
          : {}),
        ...(profileFields.bio !== undefined ? { bio: profileFields.bio } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    if (interestIds) {
      await this.db.delete(schema.userInterests).where(eq(schema.userInterests.userId, userId));
      if (interestIds.length > 0) {
        await this.db
          .insert(schema.userInterests)
          .values(interestIds.map((interestId) => ({ userId, interestId })));
      }
    }

    return this.getProfile(userId);
  }

  async listInterests() {
    return this.db.select().from(schema.interests);
  }

  private async requireUser(userId: string) {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!user) throw new NotFoundException("User not found.");
    return user;
  }
}
