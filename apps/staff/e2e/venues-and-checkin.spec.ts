import { expect, test } from "@playwright/test";
import {
  adminBackdoorLogin,
  apiBookAndPay,
  apiSignUpVerifiedMember,
  loginAsAdminDirect,
  nearFutureSlotIso,
  waitForMatch,
} from "./helpers";

const API_BASE = process.env.VITE_API_BASE_URL ?? "http://localhost:4000/v1";

/**
 * The admin-facing venue lifecycle, driven through the real UI: a new venue
 * starts hidden from members until CCTV is verified, then goes live. Covers
 * the exact gap that was blocking the dashboard before this venue/checkins
 * backend work landed (see docs/README.md's TROUBLESHOOTING notes).
 */
test("an admin can create a venue, verify its CCTV, and it goes live", async ({ page }) => {
  await loginAsAdminDirect(page);
  await page.waitForURL("**/metrics");

  await page.getByRole("link", { name: "Venues" }).click();
  await page.waitForURL("**/venues");

  const venueName = `E2E Test Cafe ${Date.now()}`;
  await page.fill("#v-name", venueName);
  await page.fill("#v-address", "42 Test Street");
  await page.fill("#v-city", "Bengaluru");
  await page.getByRole("button", { name: "CAFE" }).click();
  await page.getByRole("button", { name: "Create venue" }).click();

  const row = page.locator(".list-row", { hasText: venueName });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText("Pending CCTV verification")).toBeVisible();

  await row.getByRole("button", { name: "Verify CCTV & activate" }).click();
  await expect(row.getByText("Active", { exact: true })).toBeVisible({ timeout: 10_000 });
});

/**
 * The single most important staff workflow: two members get matched into
 * the same venue/slot, staff see them on the check-in roster identified
 * only by a short reference code (never a name — see docs/README.md's "How
 * check-in identifies people"), and checking each of them in through the
 * real dashboard actually flips their booking status and, once both have
 * arrived, triggers the identity reveal.
 */
test("staff can check matched members in via the roster, revealing them to each other", async ({
  page,
}) => {
  const memberA = await apiSignUpVerifiedMember("Roster Test A");
  const memberB = await apiSignUpVerifiedMember("Roster Test B");

  // Set up the venue via a direct API call (using the same admin backdoor
  // as the UI session below) — venue creation itself is already exercised
  // through the real UI by the previous test, so this one can spend its
  // time on the roster/check-in flow that's actually under test here.
  const { accessToken: adminToken } = await adminBackdoorLogin();
  const venueName = `E2E Roster Venue ${Date.now()}`;
  const createRes = await fetch(`${API_BASE}/venues`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: venueName, addressLine: "7 Roster Road", city: "Bengaluru", tier: "CAFE" }),
  });
  const venue = await createRes.json();
  await fetch(`${API_BASE}/venues/${venue.id}/cctv-verify`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const slotDate = nearFutureSlotIso();
  const bookingIdA = await apiBookAndPay(memberA.accessToken, venue.id, slotDate);
  const bookingIdB = await apiBookAndPay(memberB.accessToken, venue.id, slotDate);
  await waitForMatch(memberA.accessToken, bookingIdA);

  const referenceA = bookingIdA.slice(0, 8).toUpperCase();
  const referenceB = bookingIdB.slice(0, 8).toUpperCase();

  await loginAsAdminDirect(page);
  await page.waitForURL("**/metrics");
  await page.getByRole("link", { name: "Check-in" }).click();
  await page.waitForURL("**/roster");

  // If this admin account has more than one venue (from earlier runs),
  // pick the one this test just created. `.count()` does NOT auto-wait —
  // it reads the DOM synchronously — so right after navigating to
  // /roster, before listMyVenues() has resolved, it would read 0 and skip
  // the click even though the chip is about to render. Wait for the
  // picker itself first (present once there's more than one venue), then
  // let `.click()`'s own auto-waiting find the specific chip once it
  // appears.
  const venuePicker = page.locator(".venue-picker");
  if (await venuePicker.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await venuePicker.locator(".chip", { hasText: venueName }).click({ timeout: 10_000 });
  }

  const rowA = page.locator(".roster-row", { hasText: referenceA });
  const rowB = page.locator(".roster-row", { hasText: referenceB });
  await expect(rowA).toBeVisible({ timeout: 15_000 });
  await expect(rowB).toBeVisible({ timeout: 15_000 });
  // The whole point of this mechanic: no member name anywhere on this page.
  await expect(page.getByText("Roster Test A")).not.toBeVisible();
  await expect(page.getByText("Roster Test B")).not.toBeVisible();

  await rowA.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText(/waiting on the other person/)).toBeVisible({ timeout: 10_000 });
  await expect(rowA.getByText("Checked in")).toBeVisible();

  await rowB.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText(/both parties have now arrived/)).toBeVisible({ timeout: 10_000 });
  await expect(rowB.getByText("Checked in")).toBeVisible();
});
