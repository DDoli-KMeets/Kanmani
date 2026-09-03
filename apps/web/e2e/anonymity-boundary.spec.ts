import { expect, test } from "@playwright/test";
import { adminBackdoorLogin, getBookingViaApi, signUpFullyVerifiedMember } from "./helpers";

/**
 * The single most important behavior in the product, verified through the
 * actual rendered page rather than just the API response: two members
 * booked into the same slot at the same venue must stay mutually anonymous
 * — no name, no id — right up until BOTH have been checked in, at which
 * point (and only then) the name appears. A regression here is a privacy
 * incident, not a cosmetic bug, so this test reads the DOM, not just JSON.
 */
test("a match stays anonymous until both parties check in, then reveals", async ({ browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await signUpFullyVerifiedMember(pageA, "Anon Test Asha", "FEMALE");
  await signUpFullyVerifiedMember(pageB, "Anon Test Vikram", "MALE");

  // Both book the first venue at the same (first-listed) slot, so the
  // matcher's overlap window pairs them up.
  for (const p of [pageA, pageB]) {
    await p.locator(".card-tap").first().waitFor();
    await p.locator(".card-tap").first().click();
    await p.waitForURL("**/venues/**");
    await p.selectOption("#slot", { index: 0 });
    await p.getByRole("button", { name: /Book & pay/ }).click();
    await p.waitForURL("**/pay/**");
    await p.getByRole("button", { name: "Simulate successful payment" }).click();
    await p.getByText("You're booked").waitFor({ timeout: 10_000 });
  }

  await pageA.getByRole("button", { name: "View my meetup" }).click();
  await pageA.waitForURL("**/meetups/**");
  const bookingIdA = pageA.url().split("/meetups/")[1];

  const tokenA = await pageA.evaluate(() => localStorage.getItem("kmeets_access_token"));
  if (!tokenA) throw new Error("Member A has no access token in localStorage");

  // Poll the API (fast, deterministic) rather than the UI's own slower
  // polling interval, so the test isn't tied to that interval's timing.
  let matched = false;
  for (let i = 0; i < 20; i++) {
    const booking = await getBookingViaApi(tokenA, bookingIdA);
    if (booking.match) {
      matched = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  expect(matched).toBe(true);

  await pageA.reload();
  await pageA.getByText("Your match").waitFor({ timeout: 10_000 });

  await expect(pageA.getByText("Hidden until you both check in")).toBeVisible();
  await expect(pageA.getByText("Anon Test Vikram")).not.toBeVisible();
  // Belt and suspenders: the counterpart's id/name must not even be present
  // in the page's rendered text, not just visually hidden somewhere.
  const preRevealBody = await pageA.textContent("body");
  expect(preRevealBody).not.toContain("Anon Test Vikram");

  // Check both bookings in via the API as a SUPER_ADMIN would (the staff
  // dashboard's own check-in flow is covered by apps/staff's e2e suite).
  const { accessToken: adminToken } = await adminBackdoorLogin();
  const bookingIdB = pageB.url().includes("/meetups/")
    ? pageB.url().split("/meetups/")[1]
    : await (async () => {
        await pageB.getByRole("button", { name: "View my meetup" }).click();
        await pageB.waitForURL("**/meetups/**");
        return pageB.url().split("/meetups/")[1];
      })();

  for (const id of [bookingIdA, bookingIdB]) {
    const res = await fetch(`http://localhost:4000/v1/checkins/${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`Check-in failed for ${id}: ${res.status} ${await res.text()}`);
  }

  await pageA.reload();
  await pageA.getByText("Your match").waitFor({ timeout: 10_000 });
  await expect(pageA.getByText("Anon Test Vikram")).toBeVisible({ timeout: 10_000 });
  await expect(pageA.getByText(/both checked in/)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("one member cannot read another member's booking (IDOR)", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await signUpFullyVerifiedMember(pageA, "IDOR Test A");
  await signUpFullyVerifiedMember(pageB, "IDOR Test B");

  await pageA.locator(".card-tap").first().waitFor();
  await pageA.locator(".card-tap").first().click();
  await pageA.waitForURL("**/venues/**");
  await pageA.getByRole("button", { name: /Book & pay/ }).click();
  await pageA.waitForURL("**/pay/**");
  await pageA.getByRole("button", { name: "Simulate successful payment" }).click();
  await pageA.getByText("You're booked").waitFor({ timeout: 10_000 });
  await pageA.getByRole("button", { name: "View my meetup" }).click();
  await pageA.waitForURL("**/meetups/**");
  const bookingIdA = pageA.url().split("/meetups/")[1];

  const tokenB = await pageB.evaluate(() => localStorage.getItem("kmeets_access_token"));
  const res = await fetch(`http://localhost:4000/v1/bookings/${bookingIdA}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  expect(res.status).toBe(403);

  await ctxA.close();
  await ctxB.close();
});
