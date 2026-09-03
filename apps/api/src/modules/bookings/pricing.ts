import type { VenueTier } from "@kmeets/shared";

/**
 * Blended average ticket price per venue tier, in rupees — from the
 * Investor Document §08 Revenue Model. A real pricing engine (dynamic by
 * time-of-day/demand) is a SHOULD-have for later; a fixed price per tier is
 * enough to validate the booking→payment→match flow end-to-end now.
 */
export const TIER_PRICE_RUPEES: Record<VenueTier, number> = {
  CAFE: 350,
  MID: 750,
  PREMIUM: 1250,
  LUXURY: 1800,
};

export function priceForTierPaise(tier: VenueTier): number {
  return TIER_PRICE_RUPEES[tier] * 100;
}
