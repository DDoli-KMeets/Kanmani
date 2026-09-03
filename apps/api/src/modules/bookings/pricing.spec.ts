import { priceForTierPaise, TIER_PRICE_RUPEES } from "./pricing";

describe("pricing", () => {
  it("converts every tier's rupee price to whole paise (never fractional)", () => {
    for (const tier of Object.keys(TIER_PRICE_RUPEES) as (keyof typeof TIER_PRICE_RUPEES)[]) {
      const paise = priceForTierPaise(tier);
      expect(Number.isInteger(paise)).toBe(true);
      expect(paise).toBe(TIER_PRICE_RUPEES[tier] * 100);
    }
  });

  it("matches the blended average tickets from the Investor Document §08", () => {
    expect(TIER_PRICE_RUPEES.CAFE).toBe(350);
    expect(TIER_PRICE_RUPEES.MID).toBe(750);
    expect(TIER_PRICE_RUPEES.PREMIUM).toBe(1250);
    expect(TIER_PRICE_RUPEES.LUXURY).toBe(1800);
  });
});
