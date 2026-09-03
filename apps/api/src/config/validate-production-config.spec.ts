import { findProductionConfigProblems } from "./validate-production-config";

/**
 * Guards the one boot-time check standing between "a forgotten env var
 * during a rushed deploy" and shipping forgeable auth tokens, free mock
 * "payments", or an auto-approved mock "KYC" check to real users. If this
 * ever starts finding zero problems in an unsafe config, that's a real
 * production incident waiting to happen, not a passing test to celebrate.
 */
describe("findProductionConfigProblems", () => {
  const safeEnv = {
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "a".repeat(40),
    JWT_REFRESH_SECRET: "b".repeat(40),
    SMS_PROVIDER: "msg91",
    KYC_PROVIDER: "digio",
    PAYMENT_PROVIDER: "razorpay",
  };

  it("finds nothing wrong with a fully configured production environment", () => {
    expect(findProductionConfigProblems(safeEnv)).toEqual([]);
  });

  it("flags a missing JWT secret", () => {
    const problems = findProductionConfigProblems({ ...safeEnv, JWT_ACCESS_SECRET: undefined });
    expect(problems.some((p) => p.includes("JWT_ACCESS_SECRET"))).toBe(true);
  });

  it("flags a JWT secret shorter than 32 characters", () => {
    const problems = findProductionConfigProblems({ ...safeEnv, JWT_REFRESH_SECRET: "too-short" });
    expect(problems.some((p) => p.includes("JWT_REFRESH_SECRET"))).toBe(true);
  });

  it("flags the committed .env.example placeholder secret", () => {
    // The real placeholder strings in .env.example happen to also be
    // under 32 characters, so this is caught (at least) by the length
    // check — the point of this test is simply that it's rejected, not
    // which specific reason the message gives.
    const problems = findProductionConfigProblems({
      ...safeEnv,
      JWT_ACCESS_SECRET: "dev-only-change-me-access",
    });
    expect(problems.some((p) => p.includes("JWT_ACCESS_SECRET"))).toBe(true);
  });

  it("flags the access and refresh secrets being identical", () => {
    const sameSecret = "c".repeat(40);
    const problems = findProductionConfigProblems({
      ...safeEnv,
      JWT_ACCESS_SECRET: sameSecret,
      JWT_REFRESH_SECRET: sameSecret,
    });
    expect(problems.some((p) => p.includes("must not be the same value"))).toBe(true);
  });

  it.each(["SMS_PROVIDER", "KYC_PROVIDER", "PAYMENT_PROVIDER"] as const)(
    "flags %s still set to mock",
    (envVar) => {
      const problems = findProductionConfigProblems({ ...safeEnv, [envVar]: "mock" });
      expect(problems.some((p) => p.includes(envVar))).toBe(true);
    },
  );

  it("treats a provider var left unset the same as explicit mock (matches the services' own fallback)", () => {
    const problems = findProductionConfigProblems({ ...safeEnv, PAYMENT_PROVIDER: undefined });
    expect(problems.some((p) => p.includes("PAYMENT_PROVIDER"))).toBe(true);
  });
});
