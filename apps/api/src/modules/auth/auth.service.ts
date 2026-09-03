import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { eq, gte, and, sql } from "drizzle-orm";
import type Redis from "ioredis";
import { randomInt } from "node:crypto";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import { REDIS } from "../../redis/redis.module";
import { SMS_PROVIDER } from "../../integrations/sms/sms-provider.interface";
import type { SmsProvider } from "../../integrations/sms/sms-provider.interface";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const OTP_MAX_REQUESTS_PER_HOUR = 5;
const OTP_LENGTH = 6;
// Bounds how many wrong codes can be guessed against one requested OTP,
// independent of (and in addition to) the per-IP throttle on the verify
// endpoint — a distributed attacker spreading guesses across many IPs
// would otherwise sail past that throttle entirely. Once exceeded, the
// code is invalidated outright, so the attacker is back to square one:
// requesting a fresh code, which is itself rate-limited to 5/hour per
// phone number.
const MAX_OTP_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    private readonly jwt: JwtService,
  ) {}

  async requestOtp(phone: string): Promise<{ expiresInSeconds: number; devCode?: string }> {
    await this.enforceRateLimit(phone);

    const code = randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, "0");
    await this.redis.set(this.otpKey(phone), code, "EX", OTP_TTL_SECONDS);

    await this.db.insert(schema.otpRequestLog).values({ phone });
    await this.sms.sendOtp(phone, code);

    // Sandbox-only convenience: a mock-test deploy (see docs/SANDBOX_SETUP.md)
    // has no real SMS provider, so a tester with no access to server logs
    // has no other way to find their code. Gated on two separate checks —
    // the explicit opt-in flag AND SMS_PROVIDER genuinely still being mock —
    // so this can never echo a real OTP even if EXPOSE_MOCK_OTP is left set
    // by mistake after switching to a real SMS vendor.
    const exposeMockOtp =
      process.env.EXPOSE_MOCK_OTP === "true" && process.env.SMS_PROVIDER !== "msg91";

    return {
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(exposeMockOtp ? { devCode: code } : {}),
    };
  }

  async verifyOtp(phone: string, code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthenticatedUser;
  }> {
    const stored = await this.redis.get(this.otpKey(phone));

    if (!stored || stored !== code) {
      // Wrong guess against a code that does exist (as opposed to an
      // expired/never-requested one) — count it, and burn the code once
      // too many wrong guesses pile up so the attempt space per requested
      // code is bounded regardless of which IP the guesses come from.
      if (stored) await this.recordFailedAttempt(phone);
      throw new UnauthorizedException("That code is incorrect or has expired.");
    }

    await this.redis.del(this.otpKey(phone));
    await this.redis.del(this.attemptsKey(phone));
    this.logger.log(`OTP verified for ${phone}`);

    const user = await this.findOrCreateUser(phone);

    // A suspended or banned account must not be able to just log back in
    // for a fresh token — the moderation team's decision (build plan §08,
    // the three-strike system) has to actually take effect at the door,
    // not only on the next token refresh. See also JwtAuthGuard, which
    // re-checks this on every request so a mid-session ban takes effect
    // immediately rather than waiting out the access token's TTL.
    if (user.accountStatus !== "ACTIVE") {
      this.logger.warn(`Login blocked for ${phone}: account is ${user.accountStatus}`);
      throw new ForbiddenException(
        user.accountStatus === "BANNED"
          ? "This account has been permanently banned."
          : "This account is temporarily suspended.",
      );
    }

    const authUser: AuthenticatedUser = {
      userId: user.id,
      phone: user.phone,
      role: user.role,
    };

    return {
      ...(await this.issueTokens(authUser)),
      user: authUser,
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: AuthenticatedUser;
    try {
      payload = this.jwt.verify<AuthenticatedUser>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Please sign in again.");
    }

    // Re-read the user's current role rather than trusting the token's
    // stale copy — an admin who's been demoted (or a member who's been
    // banned) must not keep elevated access just because their refresh
    // token hasn't expired yet.
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId))
      .limit(1);

    if (!user || user.accountStatus !== "ACTIVE") {
      throw new UnauthorizedException("This account is no longer active.");
    }

    return this.issueTokens({ userId: user.id, phone: user.phone, role: user.role });
  }

  private async issueTokens(
    user: AuthenticatedUser,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwt.sign(user, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? "15m",
    });
    const refreshToken = this.jwt.sign(user, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_TTL ?? "30d",
    });
    return { accessToken, refreshToken };
  }

  private async findOrCreateUser(phone: string) {
    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.phone, phone))
      .limit(1);

    if (existing) {
      if (!existing.phoneVerifiedAt) {
        await this.db
          .update(schema.users)
          .set({ phoneVerifiedAt: new Date() })
          .where(eq(schema.users.id, existing.id));
      }
      return existing;
    }

    const [created] = await this.db
      .insert(schema.users)
      .values({ phone, phoneVerifiedAt: new Date() })
      .returning();
    return created;
  }

  private async enforceRateLimit(phone: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.otpRequestLog)
      .where(
        and(eq(schema.otpRequestLog.phone, phone), gte(schema.otpRequestLog.createdAt, oneHourAgo)),
      );

    if (count >= OTP_MAX_REQUESTS_PER_HOUR) {
      throw new BadRequestException(
        "Too many codes requested for this number. Please try again in a while.",
      );
    }
  }

  /** Counts a wrong guess against the currently-outstanding OTP and, once
   * MAX_OTP_VERIFY_ATTEMPTS is reached, invalidates that code outright —
   * see MAX_OTP_VERIFY_ATTEMPTS above for why. */
  private async recordFailedAttempt(phone: string): Promise<void> {
    const key = this.attemptsKey(phone);
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      // First wrong guess against this code — give the counter the same
      // lifetime as the code itself so it can't outlive what it's counting.
      await this.redis.expire(key, OTP_TTL_SECONDS);
    }
    if (attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      await this.redis.del(this.otpKey(phone));
      await this.redis.del(key);
      this.logger.warn(`OTP for ${phone} invalidated after ${attempts} failed verify attempts`);
    }
  }

  private otpKey(phone: string): string {
    return `otp:${phone}`;
  }

  private attemptsKey(phone: string): string {
    return `otp:${phone}:attempts`;
  }
}
