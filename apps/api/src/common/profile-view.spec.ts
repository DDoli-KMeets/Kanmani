import { toPreRevealProfile, toRevealedProfile, type UserRow } from "./profile-view";

/**
 * This file guards the single most important safety rule in the product:
 * a matched counterpart's name never appears anywhere before both parties
 * have checked in. If this test ever fails, do not "fix" it by adding name
 * back — treat it as a real anonymity leak and find where it happened.
 */
describe("profile-view (anonymity boundary)", () => {
  const rohan: UserRow = {
    id: "user-2",
    name: "Rohan",
    dateOfBirth: new Date(Date.UTC(1996, 8, 3)), // makes them ~29-30 at test time
    gender: "MALE",
    relationshipStatus: "SINGLE",
  };

  describe("toPreRevealProfile", () => {
    it("never includes the user's id", () => {
      const view = toPreRevealProfile(rohan) as unknown as Record<string, unknown>;
      expect(view.id).toBeUndefined();
    });

    it("never includes the user's name", () => {
      const view = toPreRevealProfile(rohan) as unknown as Record<string, unknown>;
      expect(view.name).toBeUndefined();
      expect(JSON.stringify(view)).not.toContain("Rohan");
    });

    it("does include gender and relationship status", () => {
      const view = toPreRevealProfile(rohan);
      expect(view.gender).toBe("MALE");
      expect(view.relationshipStatus).toBe("SINGLE");
    });

    it("buckets date of birth into a 5-year age range rather than an exact age", () => {
      const view = toPreRevealProfile(rohan);
      expect(view.ageRange).toMatch(/^\d+-\d+$/);
    });

    it("returns a null age range when date of birth is unknown, rather than throwing", () => {
      const noDob: UserRow = { ...rohan, dateOfBirth: null };
      expect(toPreRevealProfile(noDob).ageRange).toBeNull();
    });
  });

  describe("toRevealedProfile", () => {
    it("includes id and name once revealed", () => {
      const view = toRevealedProfile(rohan);
      expect(view.id).toBe("user-2");
      expect(view.name).toBe("Rohan");
    });

    it("still includes everything the pre-reveal view has", () => {
      const pre = toPreRevealProfile(rohan);
      const revealed = toRevealedProfile(rohan);
      expect(revealed.gender).toBe(pre.gender);
      expect(revealed.relationshipStatus).toBe(pre.relationshipStatus);
      expect(revealed.ageRange).toBe(pre.ageRange);
    });
  });
});
