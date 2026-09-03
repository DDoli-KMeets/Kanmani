// Shapes returned by the K-Meets API. Kept hand-written and close to the
// actual Drizzle rows/service return values in apps/api rather than
// generated, since the API doesn't (yet) publish an OpenAPI schema — see
// docs/README.md "Current status". If a field is added on the backend,
// mirror it here.

export interface AuthenticatedUser {
  userId: string;
  phone: string;
  role: "MEMBER" | "VENUE_STAFF" | "TRUST_AND_SAFETY" | "SUPER_ADMIN";
}

export interface UserProfile {
  id: string;
  phone: string;
  name: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  relationshipStatus: string | null;
  bio: string | null;
  role: AuthenticatedUser["role"];
  accountStatus: string;
  createdAt: string;
  interests: Interest[];
}

export interface Interest {
  id: string;
  name: string;
  category: string;
}

export type KycStatusValue = "NOT_STARTED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface KycStatusResponse {
  status: KycStatusValue;
  rejectionReason?: string | null;
}

export interface Venue {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  tier: "CAFE" | "MID" | "PREMIUM" | "LUXURY";
  status: string;
  latitude?: number | null;
  longitude?: number | null;
}

export type BookingStatusValue =
  | "PENDING_MATCH"
  | "MATCHED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface CounterpartPreReveal {
  ageRange: string | null;
  gender: string | null;
  relationshipStatus: string | null;
}

export interface CounterpartRevealed extends CounterpartPreReveal {
  id: string;
  name: string | null;
}

export interface BookingMatch {
  id: string;
  status: string;
  revealed: boolean;
  counterpart: CounterpartPreReveal | CounterpartRevealed;
}

export interface Booking {
  id: string;
  reference: string;
  userId: string;
  venueId: string;
  slotDate: string;
  format: "ONE_ON_ONE" | "GROUP";
  status: BookingStatusValue;
  pricePaidPaise: number;
  cancelledAt: string | null;
  createdAt: string;
  match: BookingMatch | null;
}

export interface Payment {
  id: string;
  userId: string;
  purpose: "BOOKING" | "EVENT_RSVP";
  bookingId: string | null;
  amountPaise: number;
  status: "CREATED" | "PAID" | "FAILED" | "REFUNDED";
  provider: string;
}

export interface CreateBookingResponse {
  booking: Booking;
  payment: Payment;
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  revieweeId: string | null;
  venueId: string;
  rating: number;
  comment: string | null;
  wantsToConnect: boolean;
  createdAt: string;
}

export interface ConnectionStatus {
  iHaveReviewed: boolean;
  iWantToConnect: boolean;
  counterpartHasReviewed: boolean;
  mutual: boolean;
}

export type ReportReason =
  | "inappropriate_behavior"
  | "safety_concern"
  | "no_show"
  | "fake_profile"
  | "harassment"
  | "other";

export interface SosAlert {
  id: string;
  bookingId: string | null;
  userId: string;
  venueId: string | null;
  status: "TRIGGERED" | "ACKNOWLEDGED" | "RESOLVED";
  triggeredAt: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  venueId: string | null;
  locationText: string | null;
  startsAt: string;
  capacity: number;
  priceRupees: number;
  eventType: "trip" | "trail_run" | "farm_day" | "other";
}

export interface EventRsvp {
  id: string;
  eventId: string;
  userId: string;
  status: "REGISTERED" | "WAITLIST" | "ATTENDED" | "CANCELLED";
}
