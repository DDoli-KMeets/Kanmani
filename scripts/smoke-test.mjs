#!/usr/bin/env node
// Post-deployment smoke test — Phase 14 "post-deployment verification" of
// the build plan. Run this against a real deployed environment right after
// a deploy, before telling anyone it's live, to catch the class of failure
// that "the build succeeded" doesn't: a missing env var, a database the
// app can't actually reach, a migration that didn't run.
//
// Usage:
//   node scripts/smoke-test.mjs --base-url https://api.kmeets.in/v1
//   node scripts/smoke-test.mjs --base-url http://localhost:4000/v1 --with-auth-flow --redis-url redis://localhost:6379
//
// Or via env vars: BASE_URL, REDIS_URL.
//
// Two levels of check:
//
//   1. Health only (default, always safe anywhere): confirms the API is up
//      and can actually reach its database and Redis — see
//      apps/api/src/modules/health/health.controller.ts.
//
//   2. Full auth flow (--with-auth-flow, needs --redis-url or REDIS_URL):
//      signs up a throwaway phone number for real, through the real
//      OTP-request -> OTP-verify -> authenticated-request path. Reads the
//      OTP code directly out of Redis the same way the mock SMS provider
//      writes it (apps/api/src/modules/auth/auth.service.ts) instead of
//      receiving a text.
//
//      SAFETY: only run --with-auth-flow against an environment where
//      SMS_PROVIDER=mock. Against a real SMS_PROVIDER (msg91 etc.), this
//      would trigger an actual text message to a made-up phone number —
//      wasted vendor spend at best, a real stranger's phone at worst. This
//      script does not know which provider the target is running, so it
//      cannot enforce this for you: it's on whoever runs it with this flag.

import { setTimeout as sleep } from "node:timers/promises";

function parseArgs(argv) {
  const args = { baseUrl: process.env.BASE_URL, redisUrl: process.env.REDIS_URL, withAuthFlow: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base-url") args.baseUrl = argv[++i];
    else if (arg === "--redis-url") args.redisUrl = argv[++i];
    else if (arg === "--with-auth-flow") args.withAuthFlow = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function log(ok, label, detail) {
  const mark = ok ? "✓" : "✕";
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function checkHealth(apiRoot) {
  const url = `${apiRoot}/health`;
  try {
    const res = await fetch(url);
    const body = await res.json().catch(() => null);
    const ok = res.status === 200 && body?.status === "ok";
    log(ok, "GET /health", ok ? undefined : `HTTP ${res.status} — ${JSON.stringify(body)}`);
    return ok;
  } catch (err) {
    log(false, "GET /health", `request failed — ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function freshTestPhone() {
  // A throwaway, valid-shaped Indian mobile number (+91 + digit 6-9 +
  // 9 more digits — see RequestOtpDto) that's unique per run so repeat
  // smoke tests never collide with each other or trip the per-phone OTP
  // rate limit from a previous run.
  const suffix = Date.now().toString().slice(-9).padStart(9, "0");
  return `+919${suffix}`;
}

async function runAuthFlow(baseUrl, redisUrl) {
  let Redis;
  try {
    ({ default: Redis } = await import("ioredis"));
  } catch {
    log(false, "auth flow", "ioredis isn't installed — run `pnpm install` at the repo root and retry");
    return false;
  }

  const phone = freshTestPhone();
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
  } catch (err) {
    log(false, "auth flow", `couldn't reach Redis at ${redisUrl} — ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }

  try {
    const requestRes = await fetch(`${baseUrl}/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!requestRes.ok) {
      log(false, "POST /auth/otp/request", `HTTP ${requestRes.status}`);
      return false;
    }
    log(true, "POST /auth/otp/request");

    let code;
    for (let attempt = 0; attempt < 30; attempt++) {
      code = await redis.get(`otp:${phone}`);
      if (code) break;
      await sleep(300);
    }
    if (!code) {
      log(false, "read OTP from Redis", `no code appeared for ${phone} within 9s`);
      return false;
    }
    log(true, "read OTP from Redis");

    const verifyRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const verifyBody = await verifyRes.json().catch(() => null);
    if (!verifyRes.ok || !verifyBody?.accessToken) {
      log(false, "POST /auth/otp/verify", `HTTP ${verifyRes.status} — ${JSON.stringify(verifyBody)}`);
      return false;
    }
    log(true, "POST /auth/otp/verify");

    const meRes = await fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${verifyBody.accessToken}` },
    });
    const meBody = await meRes.json().catch(() => null);
    const meOk = meRes.ok && meBody?.phone === phone;
    log(meOk, "GET /users/me (authenticated)", meOk ? undefined : `HTTP ${meRes.status} — ${JSON.stringify(meBody)}`);
    return meOk;
  } finally {
    await redis.quit().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.baseUrl) {
    console.log(
      "Usage: node scripts/smoke-test.mjs --base-url <API base URL, e.g. https://api.kmeets.in/v1> [--with-auth-flow --redis-url <redis URL>]",
    );
    process.exit(args.help ? 0 : 1);
  }

  const baseUrl = args.baseUrl.replace(/\/$/, "");
  // /health is version-neutral (no /v1) — see health.controller.ts — so
  // derive the API's root from whatever base URL was given.
  const apiRoot = baseUrl.replace(/\/v\d+$/, "");

  console.log(`K-Meets smoke test — ${baseUrl}\n`);

  const results = [];
  results.push(await checkHealth(apiRoot));

  if (args.withAuthFlow) {
    if (!args.redisUrl) {
      log(false, "auth flow", "--with-auth-flow needs --redis-url (or REDIS_URL) to read the mock OTP");
      results.push(false);
    } else {
      results.push(await runAuthFlow(baseUrl, args.redisUrl));
    }
  } else {
    console.log("  (skipped: full auth flow — pass --with-auth-flow to include it)");
  }

  const allOk = results.every(Boolean);
  console.log(`\n${allOk ? "PASS" : "FAIL"} — ${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exit(allOk ? 0 : 1);
}

main();
