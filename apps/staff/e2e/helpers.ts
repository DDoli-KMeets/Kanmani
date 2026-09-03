import Redis from "ioredis";
import type { Page } from "@playwright/test";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const API_BASE = process.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1";

/** A fresh, valid-format Indian mobile number for each test run, so tests
 * never collide with each other's accounts or hit the per-phone rate limit
 * from a previous run. */
export function freshPhoneDigits(): string {
  return "9" + Math.floor(100000000 + Math.random() * 900000000);
}

async function readOtpFromRedis(phone: string): Promise<string> {
  const redis = new Redis(REDIS_URL);
  try {
    for (let i = 0; i < 30; i++) {
      const code = await redis.get(`otp:${phone}`);
      if (code) return code;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`No OTP appeared in Redis for ${phone} within 9s`);
  } finally {
    await redis.quit();
  }
}

/**
 * Signs in via the API directly, writing the OTP straight into Redis
 * instead of calling /auth/otp/request — every test in this suite needs at
 * least one authenticated account to set up fixtures (a verified member, a
 * booking, an SOS alert…) via direct API calls, and doing that through the
 * per-IP-throttled request endpoint for every one of them would be slow and
 * flaky. Not a security bypass: it still goes through the real
 * /auth/otp/verify endpoint and requires knowing the phone number. Mirrors
 * apps/web's e2e/helpers.ts.
 */
export async function apiLogin(
  phone: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const redis = new Redis(REDIS_URL);
  const code = "123456";
  try {
    await redis.set(`otp:${phone}`, code, "EX", 300);
  } finally {
    await redis.quit();
  }
  const res = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) throw new Error(`OTP verify failed for ${phone}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, userId: data.user.userId };
}

export async function adminBackdoorLogin(): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
}> {
  const phone = process.env.SEED_ADMIN_PHONE ?? "+919999999999";
  return apiLogin(phone);
}

async function apiGet(path: string, accessToken: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path: string, accessToken: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPatch(path: string, accessToken: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Builds a fully verified member entirely through the API (no browser) —
 * what every fixture in this suite needs (a booking, an SOS trigger, a
 * report) but what the staff dashboard itself has no reason to drive
 * through its own UI. The consumer member journey itself is covered by
 * apps/web's e2e suite.
 */
export async function apiSignUpVerifiedMember(name: string): Promise<{
  accessToken: string;
  userId: string;
  phoneDigits: string;
}> {
  const phoneDigits = freshPhoneDigits();
  const { accessToken, userId } = await apiLogin(`+91${phoneDigits}`);

  const interests = await apiGet("/users/interests", accessToken);
  const interestId = interests[0]?.id;

  await apiPatch("/users/me", accessToken, {
    name,
    dateOfBirth: "1996-06-15",
    gender: "PREFER_NOT_TO_SAY",
    relationshipStatus: "SINGLE",
    ...(interestId ? { interestIds: [interestId] } : {}),
  });

  await apiPost("/kyc/submit", accessToken, { documentType: "PAN", videoReference: "e2e-fixture" });
  for (let i = 0; i < 20; i++) {
    const status = await apiGet("/kyc/status", accessToken);
    if (status.status === "VERIFIED") break;
    await new Promise((r) => setTimeout(r, 500));
  }

  return { accessToken, userId, phoneDigits };
}

/** Books a member into a venue at a given slot and immediately confirms
 * the mock payment, so the booking becomes eligible for matching — same
 * as clicking "Book & pay" then "Simulate successful payment" in the
 * consumer app. */
export async function apiBookAndPay(accessToken: string, venueId: string, slotDate: string): Promise<string> {
  const { booking, payment } = await apiPost("/bookings", accessToken, {
    venueId,
    slotDate,
    format: "ONE_ON_ONE",
  });
  await apiPost(`/payments/${payment.id}/confirm-mock`, accessToken);
  return booking.id;
}

/** Polls a member's own booking until the matching worker has paired it
 * with someone. */
export async function waitForMatch(accessToken: string, bookingId: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const booking = await apiGet(`/bookings/${bookingId}`, accessToken);
    if (booking.match) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Booking ${bookingId} was never matched`);
}

export async function apiCreateAndActivateVenue(
  adminToken: string,
  name: string,
): Promise<{ id: string }> {
  const venue = await apiPost("/venues", adminToken, {
    name,
    addressLine: "1 Test Street",
    city: "Bengaluru",
    tier: "CAFE",
  });
  await apiPatch(`/venues/${venue.id}/cctv-verify`, adminToken);
  return venue;
}

export async function apiTriggerSos(accessToken: string, bookingId?: string): Promise<{ id: string }> {
  return apiPost("/sos", accessToken, bookingId ? { bookingId } : {});
}

export async function apiFileReport(
  accessToken: string,
  reportedUserId: string,
  reason: string,
): Promise<{ id: string }> {
  return apiPost("/reports", accessToken, { reportedUserId, reason });
}

/** A slot a couple of hours from now — far enough in the future to pass
 * the "must be in the future" check, close enough to stay inside the
 * matching worker's overlap window when two bookings use the same value. */
export function nearFutureSlotIso(): string {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
}

/** Drives the real staff login screen: phone, request code, read it back
 * out of Redis, enter it. Only used for the one test that's actually
 * checking the login screen itself (access-control.spec.ts) — every other
 * test needs an already-signed-in admin and uses loginAsAdminDirect
 * instead, so it doesn't compete for the seeded admin phone's real,
 * DB-persisted OTP-request rate limit (5/hour — separate from, and not
 * relaxed by, NODE_ENV=test). */
export async function loginAsStaffViaUi(page: Page, phoneDigits: string): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("98765 43210").fill(phoneDigits);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByText("Enter the code").waitFor();
  const code = await readOtpFromRedis(`+91${phoneDigits}`);
  await page.getByPlaceholder("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify & continue" }).click();
}

const STAFF_ACCESS_TOKEN_KEY = "kmeets_staff_access_token";
const STAFF_REFRESH_TOKEN_KEY = "kmeets_staff_refresh_token";

/**
 * Signs the dashboard in as the seeded SUPER_ADMIN without touching the
 * login screen at all: gets tokens via the Redis/verify-endpoint backdoor
 * (see apiLogin above) and writes them straight into the storage keys the
 * app itself reads (client.ts). What almost every test in this suite
 * actually needs — a signed-in admin to exercise the dashboard's real
 * screens — without spending any of the admin phone's rate-limited OTP
 * requests. Not a security bypass: the tokens still come from the real
 * /auth/otp/verify endpoint.
 */
export async function loginAsAdminDirect(page: Page): Promise<void> {
  const { accessToken, refreshToken } = await adminBackdoorLogin();
  // A page must be on the app's own origin before localStorage can be set
  // for it — /login renders instantly (no data fetching) so it's a cheap
  // place to land first.
  await page.goto("/login");
  await page.evaluate(
    ({ accessKey, accessValue, refreshKey, refreshValue }) => {
      localStorage.setItem(accessKey, accessValue);
      localStorage.setItem(refreshKey, refreshValue);
    },
    {
      accessKey: STAFF_ACCESS_TOKEN_KEY,
      accessValue: accessToken,
      refreshKey: STAFF_REFRESH_TOKEN_KEY,
      refreshValue: refreshToken,
    },
  );
  await page.goto("/");
}

export { API_BASE };
