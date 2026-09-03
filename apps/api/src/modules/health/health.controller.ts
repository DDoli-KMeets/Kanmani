import { Controller, Get, Inject, ServiceUnavailableException, VERSION_NEUTRAL } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { sql } from "drizzle-orm";
import type Redis from "ioredis";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { REDIS } from "../../redis/redis.module";

/**
 * Unauthenticated by design (a hosting platform's load balancer / container
 * orchestrator can't hold a login token), version-neutral (so it's always
 * at the same predictable path regardless of API version bumps), and
 * exempt from the general rate limit (§33 "rate limiting" is about
 * protecting the app from abuse, not about a health checker hitting this
 * every few seconds doing its job). Confirms the process can actually reach
 * its database and Redis — not just that Node is running — since a
 * container that's "up" but can't reach either is not actually healthy.
 */
@Controller({ path: "health", version: VERSION_NEUTRAL })
@SkipThrottle()
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    if (!dbOk || !redisOk) {
      throw new ServiceUnavailableException({
        status: "error",
        database: dbOk ? "ok" : "unreachable",
        redis: redisOk ? "ok" : "unreachable",
      });
    }

    return { status: "ok", database: "ok", redis: "ok" };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const reply = await this.redis.ping();
      return reply === "PONG";
    } catch {
      return false;
    }
  }
}
