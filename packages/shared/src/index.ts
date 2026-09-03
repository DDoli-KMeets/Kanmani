// Shared enums, types and constants used by the API and both frontends.
// Keeping these in one place means the backend and the UIs can never silently
// disagree about what a status string means.
//
// These use the "const object + derived type" pattern rather than TS `enum`:
// PostgreSQL enum columns (via Drizzle) come back as plain string literal
// unions, and a real TS `enum` member is a distinct nominal type that a
// plain string is never assignable to — even when the text matches exactly.
// This pattern gives the same call-site ergonomics (UserRole.SUPER_ADMIN)
// while staying a plain string type underneath, so the API's database layer
// and these shared types never fight each other.

export const UserRole = {
  MEMBER: "MEMBER",
  VENUE_STAFF: "VENUE_STAFF",
  TRUST_AND_SAFETY: "TRUST_AND_SAFETY",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const KycStatus = {
  NOT_STARTED: "NOT_STARTED",
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;
export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const VenueTier = {
  CAFE: "CAFE",
  MID: "MID",
  PREMIUM: "PREMIUM",
  LUXURY: "LUXURY",
} as const;
export type VenueTier = (typeof VenueTier)[keyof typeof VenueTier];

export const BookingFormat = {
  ONE_ON_ONE: "ONE_ON_ONE",
  GROUP: "GROUP",
} as const;
export type BookingFormat = (typeof BookingFormat)[keyof typeof BookingFormat];

export const BookingStatus = {
  PENDING_MATCH: "PENDING_MATCH",
  MATCHED: "MATCHED",
  CONFIRMED: "CONFIRMED",
  CHECKED_IN: "CHECKED_IN",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const MatchStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REVEALED: "REVEALED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const PaymentStatus = {
  CREATED: "CREATED",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentPurpose = {
  BOOKING: "BOOKING",
  EVENT_RSVP: "EVENT_RSVP",
} as const;
export type PaymentPurpose = (typeof PaymentPurpose)[keyof typeof PaymentPurpose];

export const ReportStatus = {
  OPEN: "OPEN",
  INVESTIGATING: "INVESTIGATING",
  RESOLVED: "RESOLVED",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const StrikeLevel = {
  WARNING: "WARNING",
  SUSPENSION: "SUSPENSION",
  BAN: "BAN",
} as const;
export type StrikeLevel = (typeof StrikeLevel)[keyof typeof StrikeLevel];

export const SosStatus = {
  TRIGGERED: "TRIGGERED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED: "RESOLVED",
} as const;
export type SosStatus = (typeof SosStatus)[keyof typeof SosStatus];

export const EventRsvpStatus = {
  REGISTERED: "REGISTERED",
  WAITLIST: "WAITLIST",
  ATTENDED: "ATTENDED",
  CANCELLED: "CANCELLED",
} as const;
export type EventRsvpStatus = (typeof EventRsvpStatus)[keyof typeof EventRsvpStatus];

// Fields visible about a match BEFORE both parties have checked in.
// Anything not in this list (name, photo, phone) must never be serialized
// to the other party pre-reveal — enforced in the API layer, not just here.
export const PRE_REVEAL_VISIBLE_FIELDS = [
  "ageRange",
  "gender",
  "relationshipStatus",
  "interests",
] as const;

export const MIN_AGE_YEARS = 18;

/**
 * Shared so every place that needs to enforce the 18+ rule (profile
 * updates, booking creation) computes age the same way — a duplicated,
 * drifted copy of this logic is exactly how an age gate quietly stops
 * matching what it's supposed to enforce.
 */
export function calculateAge(dateOfBirth: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}
