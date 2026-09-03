import { apiFetch } from "./client";
import type {
  AdminMetrics,
  AuthenticatedUser,
  CheckinResult,
  KycSubmission,
  Report,
  ReportReason,
  RosterEntry,
  SosAlert,
  StaffProfile,
  UserSummary,
  Venue,
} from "./types";

// --- Auth ---

export function getMe() {
  return apiFetch<StaffProfile>("/users/me");
}

export function requestOtp(phone: string) {
  // devCode is only ever present on a mock-provider sandbox deploy that has
  // explicitly opted in (EXPOSE_MOCK_OTP=true) — see docs/SANDBOX_SETUP.md.
  // A real deployment with a real SMS provider never sends this field.
  return apiFetch<{ expiresInSeconds: number; devCode?: string }>("/auth/otp/request", {
    method: "POST",
    body: { phone },
    auth: false,
  });
}

export function verifyOtp(phone: string, code: string) {
  return apiFetch<{ accessToken: string; refreshToken: string; user: AuthenticatedUser }>(
    "/auth/otp/verify",
    { method: "POST", body: { phone, code }, auth: false },
  );
}

// --- Venues ---

export function listMyVenues() {
  return apiFetch<Venue[]>("/venues/mine");
}

export interface CreateVenueInput {
  name: string;
  addressLine: string;
  city: string;
  tier: Venue["tier"];
  ownerContactName?: string;
  ownerContactPhone?: string;
}

export function createVenue(dto: CreateVenueInput) {
  return apiFetch<Venue>("/venues", { method: "POST", body: dto });
}

export function verifyCctv(venueId: string) {
  return apiFetch<Venue>(`/venues/${venueId}/cctv-verify`, { method: "PATCH" });
}

// --- Check-ins ---

export function getRoster(venueId: string) {
  return apiFetch<RosterEntry[]>(`/checkins/venue/${venueId}`);
}

export function confirmCheckin(bookingId: string) {
  return apiFetch<CheckinResult>(`/checkins/${bookingId}`, { method: "POST" });
}

// --- SOS ---

export function listSosAlerts() {
  return apiFetch<SosAlert[]>("/sos");
}

export function acknowledgeSos(id: string) {
  return apiFetch<SosAlert>(`/sos/${id}/acknowledge`, { method: "PATCH" });
}

export function resolveSos(id: string, notes?: string) {
  return apiFetch<SosAlert>(`/sos/${id}/resolve`, { method: "PATCH", body: { notes } });
}

// --- Moderation ---

export function listReports(status?: Report["status"]) {
  const suffix = status ? `?status=${status}` : "";
  return apiFetch<Report[]>(`/reports${suffix}`);
}

export function resolveReport(id: string, resolution: string, strikeLevel?: "WARNING" | "SUSPENSION" | "BAN") {
  return apiFetch<Report>(`/reports/${id}/resolve`, { method: "PATCH", body: { resolution, strikeLevel } });
}

export function fileReport(reportedUserId: string, reason: ReportReason, bookingId?: string, details?: string) {
  return apiFetch<Report>("/reports", { method: "POST", body: { reportedUserId, reason, bookingId, details } });
}

// --- Admin ---

export function lookupUsers(userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve<UserSummary[]>([]);
  return apiFetch<UserSummary[]>("/admin/users/lookup", { method: "POST", body: { userIds } });
}

export function findUserByPhone(phone: string) {
  return apiFetch<UserSummary>(`/admin/users/by-phone?phone=${encodeURIComponent(phone)}`);
}

export function getMetrics() {
  return apiFetch<AdminMetrics>("/admin/metrics");
}

export function assignVenueStaff(venueId: string, userId: string) {
  return apiFetch<{ venueId: string; userId: string }>("/admin/venue-staff", {
    method: "POST",
    body: { venueId, userId },
  });
}

export function setStaffRole(userId: string, role: "TRUST_AND_SAFETY" | "SUPER_ADMIN") {
  return apiFetch<UserSummary>("/admin/staff-role", { method: "POST", body: { userId, role } });
}

// --- KYC review queue ---

export function listKycQueue(status?: KycSubmission["status"]) {
  const suffix = status ? `?status=${status}` : "";
  return apiFetch<KycSubmission[]>(`/admin/kyc${suffix}`);
}

export function decideKyc(id: string, decision: "VERIFIED" | "REJECTED", reason?: string) {
  return apiFetch<KycSubmission>(`/admin/kyc/${id}/decide`, { method: "PATCH", body: { decision, reason } });
}
