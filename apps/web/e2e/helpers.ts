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

/**
 * Reads the OTP the mock SMS provider stored in Redis for a phone number —
 * the same place a real test (or a developer with `SMS_PROVIDER=mock`)
 * would look, since no real SMS is ever sent. Mirrors apps/api's own e2e
 * suite (test/app.e2e-spec.ts).
 */
export async function readOtpFromRedis(phoneDigits: string): Promise<string> {
  const redis = new Redis(REDIS_URL);
  try {
    for (let i = 0; i < 30; i++) {
      const code = await redis.get(`otp:+91${phoneDigits}`);
      if (code) return code;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`No OTP appeared in Redis for +91${phoneDigits} within 9s`);
  } finally {
    await redis.quit();
  }
}

/** Drives the real login screen: enter phone, request a code, read it back
 * out of Redis (standing in for reading a text message), enter it. Ends on
 * whatever screen the app sends a fresh sign-in to (onboarding, normally). */
export async function loginAsNewMember(page: Page, phoneDigits: string): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("98765 43210").fill(phoneDigits);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByText("Enter the code").waitFor();
  const code = await readOtpFromRedis(phoneDigits);
  await page.getByPlaceholder("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify & continue" }).click();
}

export interface OnboardingProfile {
  name: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: "FEMALE" | "MALE" | "NON_BINARY" | "PREFER_NOT_TO_SAY";
}

/** Fills the onboarding form (assumes the app is already showing it) and
 * picks the first available interest — good enough for tests that don't
 * care which one, and consistent regardless of which interests are seeded. */
export async function completeOnboarding(page: Page, profile: OnboardingProfile): Promise<void> {
  await page.waitForURL("**/onboarding");
  await page.fill("#name", profile.name);
  await page.fill("#dob", profile.dateOfBirth);
  await page.selectOption("#gender", profile.gender);
  await page.selectOption("#status", "SINGLE");
  await page.locator(".chip-grid button").first().waitFor();
  await page.locator(".chip-grid button").first().click();
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Completes KYC via the mock provider (auto-verifies after a few seconds
 * — see MockKycProvider on the backend) and lands on the venues screen. */
export async function completeKyc(page: Page): Promise<void> {
  await page.waitForURL("**/kyc");
  await page.getByRole("button", { name: "Start video verification" }).click();
  await page.getByText("Verified", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Browse venues" }).click();
  await page.waitForURL("**/venues");
}

/** Signs a brand-new member all the way from the login screen through to
 * the venues list: OTP, onboarding, KYC. What most tests need before they
 * can get to the thing they're actually checking. */
export async function signUpFullyVerifiedMember(
  page: Page,
  name: string,
  gender: OnboardingProfile["gender"] = "FEMALE",
): Promise<string> {
  const phoneDigits = freshPhoneDigits();
  await loginAsNewMember(page, phoneDigits);
  await completeOnboarding(page, { name, dateOfBirth: "1996-06-15", gender });
  await completeKyc(page);
  return phoneDigits;
}

/**
 * Signs in via the API directly, writing the OTP straight into Redis
 * instead of calling /auth/otp/request — used only for the seeded admin
 * account, so tests that also drive real member sign-ups through the UI
 * (which do call that endpoint) don't compete for the same per-IP rate
 * limit. Not a security bypass: it still goes through the real
 * /auth/otp/verify endpoint and requires knowing the phone number.
 */
export async function adminBackdoorLogin(): Promise<{ accessToken: string; userId: string }> {
  const phone = process.env.SEED_ADMIN_PHONE ?? "+919999999999";
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
  if (!res.ok) {
    throw new Error(
      `Admin backdoor login failed (${res.status}). Has 'pnpm db:seed' been run against this database?`,
    );
  }
  const data = await res.json();
  return { accessToken: data.accessToken, userId: data.user.userId };
}

/** Reads a booking (including its match view) via the API with a given
 * access token — used to poll for a match without depending on UI timing. */
export async function getBookingViaApi(accessToken: string, bookingId: string) {
  const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GET booking failed: ${res.status}`);
  return res.json();
}

export { API_BASE };
