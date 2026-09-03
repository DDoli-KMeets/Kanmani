// The example values shipped in .env.example — real dev/test setups are
// expected to keep these locally (that's fine, nothing sensitive is
// signed with them outside a developer's own machine), but the app must
// refuse to start in production if they were never actually replaced.
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "dev-only-change-me-access",
  "dev-only-change-me-refresh",
]);

// Every third-party integration (SMS, KYC, payments, push) was built
// behind a swappable provider interface because no vendor account exists
// yet — see build plan §12/§14. That's the right call during development,
// but it means the difference between "safe" and "catastrophic" in
// production is a single environment variable: MockPaymentProvider marks
// every booking paid for free, MockKycProvider auto-verifies every ID
// after a few seconds with no real check, and MockSmsProvider logs the
// login code to the server console instead of texting it to the person
// who owns that phone number. None of those are acceptable to ship live
// by mistake (a forgotten env var during a rushed deploy, say).
const PROVIDER_ENV_VARS = ["SMS_PROVIDER", "KYC_PROVIDER", "PAYMENT_PROVIDER"] as const;

export interface ProductionConfigEnv {
  NODE_ENV?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  SMS_PROVIDER?: string;
  KYC_PROVIDER?: string;
  PAYMENT_PROVIDER?: string;
}

/**
 * Returns a list of unsafe-for-production problems with the given
 * environment — empty when everything checks out. Kept as a pure function
 * of an env-shaped object (rather than reading `process.env` directly and
 * calling `process.exit` inline) specifically so it's unit-testable: a
 * silent regression here (e.g. someone "simplifying" the provider check)
 * would only ever surface as a real production incident otherwise.
 *
 * Checks:
 *  - a JWT secret that's missing, too short to resist guessing, identical
 *    to the placeholder value committed in .env.example, or identical to
 *    the *other* secret (access and refresh tokens must not be forgeable
 *    from one another) — a weak or leaked-by-default signing secret
 *    undermines every other auth/authorization check in the app;
 *  - any of the SMS/KYC/payment providers still set to "mock".
 * Build plan §33 "secrets" / "production configuration".
 */
export function findProductionConfigProblems(env: ProductionConfigEnv): string[] {
  const problems: string[] = [];
  const { JWT_ACCESS_SECRET: access, JWT_REFRESH_SECRET: refresh } = env;

  if (!access || access.length < 32) {
    problems.push("JWT_ACCESS_SECRET is missing or shorter than 32 characters");
  } else if (KNOWN_PLACEHOLDER_SECRETS.has(access)) {
    problems.push("JWT_ACCESS_SECRET is still the placeholder value from .env.example");
  }

  if (!refresh || refresh.length < 32) {
    problems.push("JWT_REFRESH_SECRET is missing or shorter than 32 characters");
  } else if (KNOWN_PLACEHOLDER_SECRETS.has(refresh)) {
    problems.push("JWT_REFRESH_SECRET is still the placeholder value from .env.example");
  }

  if (access && refresh && access === refresh) {
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be the same value");
  }

  for (const envVar of PROVIDER_ENV_VARS) {
    if ((env[envVar] ?? "mock").toLowerCase() === "mock") {
      problems.push(`${envVar} is still "mock" — set it to a real vendor before going live`);
    }
  }

  return problems;
}

/**
 * Refuses to boot (via process.exit) in production with unsafe
 * configuration. A no-op outside production — dev/test setups are
 * expected to run on mock providers and placeholder-adjacent secrets.
 */
export function validateProductionConfig(env: ProductionConfigEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const problems = findProductionConfigProblems(env);
  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      "Refusing to start in production with unsafe configuration:\n" +
        problems.map((p) => `  - ${p}`).join("\n") +
        "\nGenerate real JWT secrets with: openssl rand -hex 32",
    );
    process.exit(1);
  }
}
