import { expect, test } from "@playwright/test";
import { apiFileReport, apiSignUpVerifiedMember, apiTriggerSos, loginAsAdminDirect } from "./helpers";

test("an SOS alert appears on the dashboard and can be acknowledged and resolved", async ({ page }) => {
  // Unique per run: the dev database this suite runs against isn't reset
  // between runs, so a fixed name would eventually match more than one row.
  const memberName = `SOS Test Member ${Date.now()}`;
  const member = await apiSignUpVerifiedMember(memberName);
  await apiTriggerSos(member.accessToken);

  await loginAsAdminDirect(page);
  await page.waitForURL("**/metrics");
  await page.getByRole("link", { name: "SOS" }).click();
  await page.waitForURL("**/sos");

  const row = page.locator(".list-row", { hasText: memberName });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText("Active — needs response")).toBeVisible();

  await row.getByRole("button", { name: "Acknowledge" }).click();
  await expect(row.getByText("Being handled")).toBeVisible({ timeout: 10_000 });

  await row.locator('input[placeholder="Resolution notes (optional)"]').fill("Checked in with member by phone, all safe.");
  await row.getByRole("button", { name: "Mark resolved" }).click();

  // Resolved alerts drop out of the active list into the collapsed history.
  await expect(row).not.toBeVisible({ timeout: 10_000 });
  await page.getByText(/Recently resolved/).click();
  await expect(page.locator(".list-row", { hasText: memberName })).toBeVisible();
});

test("a filed report shows up in the moderation queue and can be resolved", async ({ page }) => {
  const reporterName = `Report Filer ${Date.now()}`;
  const reportedName = `Reported Member ${Date.now()}`;
  const reporter = await apiSignUpVerifiedMember(reporterName);
  const reported = await apiSignUpVerifiedMember(reportedName);
  await apiFileReport(reporter.accessToken, reported.userId, "harassment");

  await loginAsAdminDirect(page);
  await page.waitForURL("**/metrics");
  await page.getByRole("link", { name: "Reports" }).click();
  await page.waitForURL("**/reports");

  const card = page.locator(".card", { hasText: reportedName }).filter({ hasText: reporterName });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText("Harassment")).toBeVisible();
  await expect(card.getByText("OPEN")).toBeVisible();

  await card.getByRole("button", { name: "Resolve" }).click();
  await card.locator("textarea").fill("Reviewed conversation logs, no policy violation found.");
  await card.getByRole("button", { name: "Submit resolution" }).click();

  // The default tab only shows OPEN reports, so a resolved one drops out of
  // it — switch to "All" to find it again and confirm the resolution stuck.
  await page.getByRole("button", { name: "All" }).click();
  const resolvedCard = page.locator(".card", { hasText: reportedName }).filter({ hasText: reporterName });
  await expect(resolvedCard.getByText(/Resolution: Reviewed conversation logs/)).toBeVisible({ timeout: 10_000 });
  await expect(resolvedCard.getByText("RESOLVED")).toBeVisible();
});
