import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { IntegrationsModule } from "./integrations/integrations.module";

import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { VenuesModule } from "./modules/venues/venues.module";
import { MatchingModule } from "./modules/matching/matching.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { CheckinsModule } from "./modules/checkins/checkins.module";
import { EventsModule } from "./modules/events/events.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { ModerationModule } from "./modules/moderation/moderation.module";
import { SosModule } from "./modules/sos/sos.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Baseline, app-wide rate limiting (on top of the tighter, endpoint-
    // specific limits on OTP requests) — a second line of defense per
    // build plan §08 "API security".
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    // Registered with no default secret/options: every place that signs or
    // verifies a token passes its own secret explicitly (access vs refresh
    // use different secrets), which is safer than one shared default.
    // global:true so JwtAuthGuard (used via @UseGuards in every feature
    // module) can resolve JwtService without every module importing
    // JwtModule itself.
    JwtModule.register({ global: true }),

    DatabaseModule,
    RedisModule,
    IntegrationsModule,

    HealthModule,
    AuthModule,
    UsersModule,
    KycModule,
    VenuesModule,
    MatchingModule,
    PaymentsModule,
    BookingsModule,
    CheckinsModule,
    EventsModule,
    ReviewsModule,
    ModerationModule,
    SosModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
