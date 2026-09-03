import { expect, test } from "@playwright/test";
import { signUpFullyVerifiedMember } from "./helpers";

/**
 * The full first-time-member path, driven through the real UI against the
 * real API: sign up, get verified, browse venues, book a slot, pay (mock),
 * and land on a meetup detail screen that reflects it. This is the
 * "does the app actually work end to end" test — see anonymity-boundary
 * .spec.ts for the safety-critical mechanic specifically.
 */
test("a new member can sign up, get verified, and book a meetup", async ({ page }) => {
  await signUpFullyVerifiedMember(page, "Journey Test User");

  const venueCards = page.locator(".card-tap");
  await expect(venueCards.first()).toBeVisible({ timeout: 10_000 });
  await venueCards.first().click();

  await page.waitForURL("**/venues/**");
  await page.getByRole("button", { name: /Book & pay/ }).click();

  await page.waitForURL("**/pay/**");
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByText("You're booked")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "View my meetup" }).click();
  await page.waitForURL("**/meetups/**");
  await expect(page.getByText(/finding you a match|Matched/)).toBeVisible({ timeout: 10_000 });
});

test("secondary screens render without error and the SOS button always works", async ({ page }) => {
  await signUpFullyVerifiedMember(page, "Nav Test User");

  await page.locator(".bottom-nav a", { hasText: "Profile" }).click();
  await page.waitForURL("**/profile");
  await expect(page.getByText("Nav Test User")).toBeVisible();

  await page.locator(".bottom-nav a", { hasText: "Community" }).click();
  await page.waitForURL("**/community");

  await page.locator(".bottom-nav a", { hasText: "Meetups" }).click();
  await page.waitForURL("**/meetups");
  await expect(page.getByText("No meetups booked yet")).toBeVisible();

  await page.locator(".sos-fab").click();
  await expect(page.getByText("Need help right now?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("booking is blocked with a clear message until KYC is verified", async ({ page }) => {
  const phoneDigits = "9" + Math.floor(100000000 + Math.random() * 900000000);
  const { loginAsNewMember, completeOnboarding } = await import("./helpers");
  await loginAsNewMember(page, phoneDigits);
  await completeOnboarding(page, { name: "Unverified User", dateOfBirth: "1995-01-01", gender: "MALE" });

  await page.waitForURL("**/kyc");
  await page.getByRole("button", { name: "I'll do this later" }).click();
  await page.waitForURL("**/venues");

  await page.locator(".card-tap").first().waitFor();
  await page.locator(".card-tap").first().click();
  await page.waitForURL("**/venues/**");
  await page.getByRole("button", { name: /Book & pay/ }).click();

  await expect(page.getByText(/Complete Video KYC/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: "Verify now" })).toBeVisible();
});
