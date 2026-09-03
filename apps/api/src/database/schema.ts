/**
 * K-Meets database schema (Drizzle ORM).
 *
 * We use Drizzle instead of the Prisma originally sketched in the build plan:
 * this sandbox's network allowlist blocks Prisma's engine-binary download
 * host (binaries.prisma.sh), which makes `prisma generate` impossible here.
 * Drizzle is pure TypeScript/JS with no native binary to fetch, so it works
 * in any environment including restricted ones — and it's an equally mature,
 * type-safe choice for a Postgres-backed Node/TypeScript API. This is called
 * out in docs/README.md as a documented deviation from the build plan.
 *
 * Design rules carried over from docs/build-plan.html §07:
 *  - No raw government ID numbers are ever stored (see kycVerifications).
 *  - User-deletable data is soft-deleted (deletedAt) so financial/safety
 *    records survive their retention window.
 *  - Every human-actionable table carries createdAt (and updatedAt where the
 *    row is ever mutated after creation).
 *  - Money is always stored as an integer number of rupees — never a float.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", [
  "MEMBER",
  "VENUE_STAFF",
  "TRUST_AND_SAFETY",
  "SUPER_ADMIN",
]);

export const genderEnum = pgEnum("gender", [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "PREFER_NOT_TO_SAY",
]);

export const relationshipStatusEnum = pgEnum("relationship_status", [
  "SINGLE",
  "IN_A_RELATIONSHIP",
  "MARRIED",
  "PREFER_NOT_TO_SAY",
]);

export const kycStatusEnum = pgEnum("kyc_status", [
  "NOT_STARTED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
]);

export const userAccountStatusEnum = pgEnum("user_account_status", [
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
]);

export const venueTierEnum = pgEnum("venue_tier", ["CAFE", "MID", "PREMIUM", "LUXURY"]);

export const venueStatusEnum = pgEnum("venue_status", [
  "PENDING_ONBOARDING",
  "ACTIVE",
  "PAUSED",
  "OFFBOARDED",
]);

export const bookingFormatEnum = pgEnum("booking_format", ["ONE_ON_ONE", "GROUP"]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING_MATCH",
  "MATCHED",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "PENDING",
  "CONFIRMED",
  "REVEALED",
  "COMPLETED",
  "CANCELLED",
]);

export const paymentPurposeEnum = pgEnum("payment_purpose", ["BOOKING", "EVENT_RSVP"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "CREATED",
  "PAID",
  "FAILED",
  "REFUNDED",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
]);

export const strikeLevelEnum = pgEnum("strike_level", ["WARNING", "SUSPENSION", "BAN"]);

export const sosStatusEnum = pgEnum("sos_status", [
  "TRIGGERED",
  "ACKNOWLEDGED",
  "RESOLVED",
]);

export const eventRsvpStatusEnum = pgEnum("event_rsvp_status", [
  "REGISTERED",
  "WAITLIST",
  "ATTENDED",
  "CANCELLED",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    phoneVerifiedAt: timestamp("phone_verified_at"),
    name: varchar("name", { length: 120 }),
    dateOfBirth: timestamp("date_of_birth"),
    gender: genderEnum("gender"),
    relationshipStatus: relationshipStatusEnum("relationship_status"),
    bio: text("bio"),
    role: userRoleEnum("role").notNull().default("MEMBER"),
    accountStatus: userAccountStatusEnum("account_status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    phoneUnique: uniqueIndex("users_phone_unique").on(t.phone),
    statusIdx: index("users_account_status_idx").on(t.accountStatus),
  }),
);

export const interests = pgTable("interests", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  category: varchar("category", { length: 80 }),
});

export const userInterests = pgTable(
  "user_interests",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    interestId: uuid("interest_id")
      .notNull()
      .references(() => interests.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: uniqueIndex("user_interests_pk").on(t.userId, t.interestId),
  }),
);

export const kycVerifications = pgTable(
  "kyc_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerReferenceId: varchar("provider_reference_id", { length: 200 }),
    status: kycStatusEnum("status").notNull().default("NOT_STARTED"),
    documentType: varchar("document_type", { length: 20 }),
    submittedAt: timestamp("submitted_at"),
    decidedAt: timestamp("decided_at"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userUnique: uniqueIndex("kyc_user_unique").on(t.userId),
  }),
);

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    addressLine: text("address_line").notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    tier: venueTierEnum("tier").notNull(),
    cctvVerifiedAt: timestamp("cctv_verified_at"),
    ownerContactName: varchar("owner_contact_name", { length: 120 }),
    ownerContactPhone: varchar("owner_contact_phone", { length: 20 }),
    status: venueStatusEnum("status").notNull().default("PENDING_ONBOARDING"),
    photos: text("photos").array().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    cityStatusIdx: index("venues_city_status_idx").on(t.city, t.status),
  }),
);

export const venueStaff = pgTable(
  "venue_staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex("venue_staff_unique").on(t.venueId, t.userId),
  }),
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    slotDate: timestamp("slot_date").notNull(),
    format: bookingFormatEnum("format").notNull().default("ONE_ON_ONE"),
    status: bookingStatusEnum("status").notNull().default("PENDING_MATCH"),
    // Always an integer number of paise — never a float — to avoid
    // floating-point rounding errors on money.
    pricePaidPaise: integer("price_paid_paise").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at"),
  },
  (t) => ({
    venueDateIdx: index("bookings_venue_date_idx").on(t.venueId, t.slotDate),
    userStatusIdx: index("bookings_user_status_idx").on(t.userId, t.status),
  }),
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingAId: uuid("booking_a_id")
      .notNull()
      .references(() => bookings.id),
    bookingBId: uuid("booking_b_id")
      .notNull()
      .references(() => bookings.id),
    matchScore: real("match_score").notNull(),
    status: matchStatusEnum("status").notNull().default("PENDING"),
    revealedAt: timestamp("revealed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    bookingAUnique: uniqueIndex("matches_booking_a_unique").on(t.bookingAId),
    bookingBUnique: uniqueIndex("matches_booking_b_unique").on(t.bookingBId),
    statusIdx: index("matches_status_idx").on(t.status),
  }),
);

// The row that actually unlocks identity reveal: a match only reveals once a
// checkin row exists for BOTH of its bookings. Enforced in MatchingService,
// never left to the client to assert.
export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at").notNull().defaultNow(),
    confirmedById: uuid("confirmed_by_id"),
  },
  (t) => ({
    bookingUnique: uniqueIndex("checkins_booking_unique").on(t.bookingId),
  }),
);

export const communityEvents = pgTable("community_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description").notNull(),
  venueId: uuid("venue_id").references(() => venues.id),
  locationText: varchar("location_text", { length: 200 }),
  startsAt: timestamp("starts_at").notNull(),
  capacity: integer("capacity").notNull(),
  priceRupees: integer("price_rupees").notNull(),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => communityEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: eventRsvpStatusEnum("status").notNull().default("REGISTERED"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex("event_rsvps_unique").on(t.eventId, t.userId),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    purpose: paymentPurposeEnum("purpose").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    eventRsvpId: uuid("event_rsvp_id").references(() => eventRsvps.id),
    amountPaise: integer("amount_paise").notNull(),
    status: paymentStatusEnum("status").notNull().default("CREATED"),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerOrderId: varchar("provider_order_id", { length: 120 }),
    providerPaymentId: varchar("provider_payment_id", { length: 120 }),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    idemUnique: uniqueIndex("payments_idempotency_unique").on(t.idempotencyKey),
    statusIdx: index("payments_status_idx").on(t.status),
  }),
);

export const venuePayouts = pgTable(
  "venue_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    grossFoodBillPaise: integer("gross_food_bill_paise").notNull(),
    commissionPaise: integer("commission_paise").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    venuePeriodIdx: index("venue_payouts_venue_period_idx").on(t.venueId, t.periodStart),
  }),
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").notNull(),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    revieweeId: uuid("reviewee_id").references(() => users.id),
    venueId: uuid("venue_id").references(() => venues.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    // "optionally stay connected" (build plan §1/§2) — an opt-in per
    // reviewer, revealed as mutual only once BOTH sides of a match have
    // reviewed and both said yes. Never exposes a phone number or opens
    // messaging on its own (that's a separate, bigger product decision) —
    // just lets each side know the interest was mutual.
    wantsToConnect: boolean("wants_to_connect").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    revieweeIdx: index("reviews_reviewee_idx").on(t.revieweeId),
    // One review per person per booking — resubmitting (e.g. to change the
    // "stay connected" answer) updates it in place instead of creating a
    // second row, which would otherwise leave the connection-status check
    // reading an arbitrary one of several answers.
    bookingReviewerUnique: uniqueIndex("reviews_booking_reviewer_unique").on(t.bookingId, t.reviewerId),
  }),
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    reportedId: uuid("reported_id")
      .notNull()
      .references(() => users.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    reason: varchar("reason", { length: 80 }).notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("OPEN"),
    resolution: text("resolution"),
    handledById: uuid("handled_by_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => ({
    statusIdx: index("reports_status_idx").on(t.status),
  }),
);

export const userStrikes = pgTable("user_strikes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  level: strikeLevelEnum("level").notNull(),
  reason: text("reason").notNull(),
  issuedById: uuid("issued_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const sosAlerts = pgTable(
  "sos_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    venueId: uuid("venue_id").references(() => venues.id),
    status: sosStatusEnum("status").notNull().default("TRIGGERED"),
    triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at"),
    resolvedAt: timestamp("resolved_at"),
    responseTimeSeconds: integer("response_time_seconds"),
    notes: text("notes"),
  },
  (t) => ({
    statusIdx: index("sos_status_idx").on(t.status),
  }),
);

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.id),
    referredId: uuid("referred_id")
      .notNull()
      .references(() => users.id),
    rewardCreditedAt: timestamp("reward_credited_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    referredUnique: uniqueIndex("referrals_referred_unique").on(t.referredId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 60 }).notNull(),
    payload: jsonb("payload").notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userReadIdx: index("notifications_user_read_idx").on(t.userId, t.readAt),
  }),
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id"),
    actorRole: varchar("actor_role", { length: 40 }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
  }),
);

// Backs OTP rate limiting with a durable record, independent of any
// in-memory cache — one row per OTP actually sent.
export const otpRequestLog = pgTable(
  "otp_request_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    phoneCreatedIdx: index("otp_phone_created_idx").on(t.phone, t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// Relations (used by Drizzle's relational query API for convenient joins)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  interests: many(userInterests),
  kycVerification: one(kycVerifications, {
    fields: [users.id],
    references: [kycVerifications.userId],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  venue: one(venues, { fields: [bookings.venueId], references: [venues.id] }),
  checkin: one(checkins, { fields: [bookings.id], references: [checkins.bookingId] }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  bookingA: one(bookings, { fields: [matches.bookingAId], references: [bookings.id] }),
  bookingB: one(bookings, { fields: [matches.bookingBId], references: [bookings.id] }),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  bookings: many(bookings),
  staff: many(venueStaff),
}));
