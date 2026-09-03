// Shapes returned by the K-Meets API, as used by the staff/admin dashboard.
// Kept close to the actual service return values in apps/api — see the
// same note in apps/web/src/api/types.ts.

export type StaffRole = "VENUE_STAFF" | "TRUST_AND_SAFETY" | "SUPER_ADMIN";

export interface AuthenticatedUser {
  userId: string;
  phone: string;
  role: StaffRole | "MEMBER";
}

export interface StaffProfile {
  id: string;
  name: string | null;
  phone: string;
  role: StaffRole | "MEMBER";
}

export interface Venue {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  tier: "CAFE" | "MID" | "PREMIUM" | "LUXURY";
  status: string;
  cctvVerifiedAt: string | null;
}

export interface RosterEntry {
  id: string;
  reference: string;
  slotDate: string;
  format: "ONE_ON_ONE" | "GROUP";
  status: "MATCHED" | "CONFIRMED" | "CHECKED_IN";
  checkedIn: boolean;
}

export interface CheckinResult {
  bookingId: string;
  revealed: boolean;
}

export interface SosAlert {
  id: string;
  bookingId: string | null;
  userId: string;
  venueId: string | null;
  status: "TRIGGERED" | "ACKNOWLEDGED" | "RESOLVED";
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  responseTimeSeconds: number | null;
  notes: string | null;
}

export type ReportReason =
  | "inappropriate_behavior"
  | "safety_concern"
  | "no_show"
  | "fake_profile"
  | "harassment"
  | "other";

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  bookingId: string | null;
  reason: ReportReason;
  details: string | null;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED";
  resolution: string | null;
  handledById: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface UserSummary {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  accountStatus: string;
}

export interface KycSubmission {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string;
  provider: string;
  status: "NOT_STARTED" | "PENDING" | "VERIFIED" | "REJECTED";
  documentType: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
}

export interface AdminMetrics {
  totalUsers: number;
  verifiedUsers: number;
  totalBookings: number;
  revealedMeetups: number;
  activeVenues: number;
  openReports: number;
  openSosAlerts: number;
}
