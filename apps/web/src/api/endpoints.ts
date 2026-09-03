import { apiFetch } from "./client";
import type {
  AuthenticatedUser,
  Booking,
  CommunityEvent,
  ConnectionStatus,
  CreateBookingResponse,
  EventRsvp,
  Interest,
  KycStatusResponse,
  Payment,
  Review,
  ReportReason,
  SosAlert,
  UserProfile,
  Venue,
} from "./types";

// --- Auth ---

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

// --- Profile ---

export function getMe() {
  return apiFetch<UserProfile>("/users/me");
}

export interface UpdateProfileInput {
  name?: string;
  dateOfBirth?: string;
  gender?: string;
  relationshipStatus?: string;
  bio?: string;
  interestIds?: string[];
}

export function updateMe(dto: UpdateProfileInput) {
  return apiFetch<UserProfile>("/users/me", { method: "PATCH", body: dto });
}

export function listInterests() {
  return apiFetch<Interest[]>("/users/interests");
}

// --- KYC ---

export function submitKyc(documentType: "PAN" | "PASSPORT", videoReference: string) {
  return apiFetch<KycStatusResponse>("/kyc/submit", {
    method: "POST",
    body: { documentType, videoReference },
  });
}

export function getKycStatus() {
  return apiFetch<KycStatusResponse>("/kyc/status");
}

// --- Venues ---

export function listVenues(params: { city?: string; tier?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.city) qs.set("city", params.city);
  if (params.tier) qs.set("tier", params.tier);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Venue[]>(`/venues${suffix}`);
}

export function getVenue(id: string) {
  return apiFetch<Venue>(`/venues/${id}`);
}

// --- Bookings ---

export function createBooking(venueId: string, slotDate: string, format: "ONE_ON_ONE" | "GROUP") {
  return apiFetch<CreateBookingResponse>("/bookings", {
    method: "POST",
    body: { venueId, slotDate, format },
  });
}

export function listMyBookings() {
  return apiFetch<Booking[]>("/bookings");
}

export function getBooking(id: string) {
  return apiFetch<Booking>(`/bookings/${id}`);
}

export function cancelBooking(id: string) {
  return apiFetch<Booking>(`/bookings/${id}`, { method: "DELETE" });
}

// --- Payments ---

export function confirmMockPayment(paymentId: string) {
  return apiFetch<Payment>(`/payments/${paymentId}/confirm-mock`, { method: "POST" });
}

// --- Reviews ---

export function createReview(bookingId: string, rating: number, comment?: string, wantsToConnect?: boolean) {
  return apiFetch<Review>("/reviews", { method: "POST", body: { bookingId, rating, comment, wantsToConnect } });
}

export function myReceivedReviews() {
  return apiFetch<Review[]>("/reviews/mine/received");
}

export function getConnectionStatus(bookingId: string) {
  return apiFetch<ConnectionStatus>(`/reviews/connection/${bookingId}`);
}

// --- Reports ---

export function fileReport(
  reportedUserId: string,
  reason: ReportReason,
  bookingId?: string,
  details?: string,
) {
  return apiFetch<{ id: string }>("/reports", {
    method: "POST",
    body: { reportedUserId, reason, bookingId, details },
  });
}

// --- SOS ---

export function triggerSos(bookingId?: string) {
  return apiFetch<SosAlert>("/sos", { method: "POST", body: { bookingId } });
}

// --- Community events ---

export function listEvents() {
  return apiFetch<CommunityEvent[]>("/events");
}

export function myEventRsvps() {
  return apiFetch<EventRsvp[]>("/events/mine/rsvps");
}

export function rsvpToEvent(eventId: string) {
  return apiFetch<{ rsvp: EventRsvp; payment: Payment | null }>(`/events/${eventId}/rsvp`, {
    method: "POST",
  });
}

export function cancelEventRsvp(eventId: string) {
  return apiFetch<EventRsvp>(`/events/${eventId}/rsvp`, { method: "DELETE" });
}
