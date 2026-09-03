import { expect, test } from "@playwright/test";
import { apiSignUpVerifiedMember, loginAsStaffViaUi } from "./helpers";

/**
 * This dashboard is for staff/admin accounts only. A regular member who
 * somehow tries to sign in here (same phone-OTP flow as the consumer app)
 * must be turned away with a clear explanation, not shown an empty or
 * broken dashboard.
 */
test("a regular member account is signed back out with an explanation", async ({ page }) => {
  const { phoneDigits } = await apiSignUpVerifiedMember("Staff Access Test Member");

  await loginAsStaffViaUi(page, phoneDigits);

  await expect(
    page.getByText("This account doesn't have staff access. Ask an admin to assign you to a venue."),
  ).toBeVisible({ timeout: 10_000 });
  // Bounced back to the phone step, not left on some half-authenticated screen.
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
});
