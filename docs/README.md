# K-Meets

K-Meets is a curated, anonymous stranger-meetup platform. A member books a
slot at a vetted café, gets matched with someone who shares their interests,
and stays anonymous — no name, no photo — until **both** people have
physically checked in at the venue. The full product plan (features, user
journeys, security model, roadmap) is in
[`docs/build-plan.html`](./build-plan.html); this file is about the code.

Written for a non-technical founder picking this repository back up after a
break. If a term here is unfamiliar, that's expected — every section says
what to do, not just what exists.

## What's in this repository

This is a **monorepo**: one Git repository holding several related
applications, managed with `pnpm` workspaces so they can share code (like the
`packages/shared` package below) without copy-pasting it.

```
kmeets/
├── apps/
│   ├── api/     — the backend server (NestJS). Everything else talks to this.
│   ├── web/     — the consumer app members use, built as a mobile web app.
│   └── staff/   — the dashboard venue staff and admins use.
├── packages/
│   └── shared/  — TypeScript types/constants shared by every app above.
└── docs/        — this documentation, plus the original product plan.
```

All three apps have real, tested code — see "Current status" below.

## Why Drizzle instead of Prisma

The build plan originally called for Prisma as the database toolkit. While
setting up the backend, `prisma generate` failed: it needs to download a
"binary" (a small pre-built program) from `binaries.prisma.sh`, and this
development sandbox's network rules block that specific address. Rather than
lose time working around a sandbox-specific restriction, the backend uses
**Drizzle ORM** instead — a different, equally mature toolkit for talking to
a Postgres database from TypeScript, written in pure TypeScript with no
binary download required anywhere, in any environment. Functionally it does
the same job Prisma would have. This is a one-time, low-risk substitution;
nothing about the product or the plan changed because of it.

## The core mechanic, and how it's protected

The entire product depends on one guarantee: **you cannot see who you were
matched with until both of you have checked in in person.** If that
guarantee ever broke, the product wouldn't just have a bug — it would betray
what it promised members.

Because of that, this isn't left to "the app just doesn't show the name."
The server itself refuses to send a match's name, ID, or any identifying
field over the network until a `Checkin` record exists for **both** people
in that booking. The one function that decides what a member is allowed to
see (`apps/api/src/common/profile-view.ts`) is small and deliberately
isolated, and it is covered by both a focused unit test and a full
end-to-end test that proves the boundary from the outside — by making real
HTTP requests, the way a phone would — not just by reading the code.

## Prerequisites (one-time setup on a new machine)

You'll need these installed before anything else works:

1. **Node.js version 22.** The file `.nvmrc` in this repo pins the exact
   version. If you use `nvm`, running `nvm use` in this folder picks it up
   automatically.
2. **pnpm** — the package manager this repo uses instead of plain `npm`.
   Install it once with `npm install -g pnpm`.
3. **PostgreSQL 16** — the database. Easiest via Docker (see below), or a
   native install.
4. **Redis 7** — used for background job processing (the matching engine)
   and short-lived data like OTP codes. Also easiest via Docker.

If you have Docker installed, the fastest way to get Postgres and Redis
running locally is:

```bash
docker run -d --name kmeets-postgres -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=kmeets_dev -p 5432:5432 postgres:16
docker run -d --name kmeets-redis -p 6379:6379 redis:7
```

## Getting the backend running

```bash
# 1. From the repo root, install every app's dependencies at once.
pnpm install

# 2. Copy the example environment file and adjust if your setup differs
#    from the defaults above.
cp apps/api/.env.example apps/api/.env

# 3. Create the database tables (this reads apps/api/src/database/schema.ts
#    and applies it to the database in your .env).
pnpm --filter @kmeets/api db:migrate

# 4. Create a starter admin account and some sample interests, so the app
#    isn't completely empty on first run.
pnpm --filter @kmeets/api db:seed

# 5. Start the API in development mode (auto-restarts on file changes).
pnpm dev:api
```

The API is now running at `http://localhost:4000`. There's nothing to look
at in a browser yet — it only serves data (JSON), not web pages — but see
"Trying it out without a frontend" below.

### Signing in as the seeded admin

Step 4 above creates (or promotes) a `SUPER_ADMIN` account for the phone
number in `SEED_ADMIN_PHONE` (defaults to `+919999999999`). Because
`SMS_PROVIDER=mock` by default, no real text message is sent — the login
code is printed to the terminal running the API instead. This is the normal
way to log in during development; see "Swappable providers" below for how
this becomes a real SMS later.

## Every external service is swappable

K-Meets needs several outside services eventually: something to send SMS
one-time codes, something to verify identity documents (KYC), a payment
processor, and push notifications. **None of these accounts exist yet** —
no company is registered, so there's nowhere to sign up for a business
Razorpay or MSG91 account yet. Building against real accounts that don't
exist isn't possible, so instead, every one of these is written as a small,
swappable interface with two implementations:

- A **mock** implementation — always safe, costs nothing, needs no
  signup, and is what every environment uses today.
- A **real** implementation, already written against each vendor's
  documented API, ready to activate the moment a real account exists.

Which one runs is controlled entirely by one environment variable per
service (`SMS_PROVIDER`, `KYC_PROVIDER`, `PAYMENT_PROVIDER`, `PUSH_PROVIDER`
in `apps/api/.env`) — no code changes needed to switch. When you're ready to
go live with a real vendor, the process is: sign up for the vendor account,
put the real API keys in `.env`, flip that one variable from `mock` to the
vendor's name, and restart the server. `docs/DEPLOYMENT.md` covers this in
more detail for each vendor.

Want to try the app in a real browser instead of running it locally?
`docs/SANDBOX_SETUP.md` walks through a free hosted deploy (still on mock
providers) in about 20 minutes.

## Getting the consumer web app running

With the API already running (previous section), in a second terminal:

```bash
pnpm dev:web
```

This opens at `http://localhost:5173` — a mobile-sized layout is intentional
(it's built mobile-first); widen your browser's dev tools to a phone preset,
or just use it on an actual phone once deployed. It covers everything a
member does: sign in by phone, set up a profile, verify identity, browse
venues, book and pay for a slot, watch a match go from hidden to revealed
once both people check in, leave a review, file a report, and trigger SOS.

There's no separate "seed some venues" step needed beyond what
`db:seed` already creates — if venue browsing looks empty, sign into
`apps/staff` (below) as the seeded admin and create one from the Venues
screen, then verify its CCTV so it goes live for members.

## Getting the staff/admin dashboard running

With the API running, in another terminal:

```bash
pnpm dev:staff
```

This opens at `http://localhost:5174`. Sign in with the same phone-OTP
flow as the consumer app — but only accounts with a staff role
(`VENUE_STAFF`, `TRUST_AND_SAFETY`, or `SUPER_ADMIN`) can get past the
login screen. The seeded admin from `db:seed` (`+919999999999` by
default) can sign in immediately and reach every screen; a regular member
account is signed straight back out with an explanation.

## Trying the backend without a frontend

Two other ways to see the API work, useful when debugging something
frontend-independent:

- **The automated test suite** (recommended) — see "How to verify the
  backend is healthy" below. It exercises the entire member journey
  (sign up, verify, book, pay, get matched, check in, get revealed) and
  prints pass/fail for each step.
- **A tool like [Postman](https://www.postman.com/) or `curl`** — send
  requests to `http://localhost:4000/v1/...` by hand. `docs/build-plan.html`
  §6 (User Journeys) describes the sequence of steps each journey follows.

## How to verify the backend is healthy

Two automated test suites exist. Run both after pulling new code, and
before trusting that a change didn't break something:

```bash
# Fast unit tests — pure logic, no database needed (pricing, the
# anonymity boundary, payment webhook signature verification).
pnpm --filter @kmeets/api test

# End-to-end tests — spins through the real member journey against a real
# (separate, disposable) test database and Redis instance. The first time
# only, create that test database (apps/api/.env.test already points at
# it, and the test suite applies migrations to it automatically):
createdb kmeets_test

pnpm --filter @kmeets/api test:e2e
```

As of this writing: **14/14 unit tests passing, 13/13 end-to-end tests
passing.** The end-to-end suite specifically proves (by making real network
requests, not by reading code) that: a match's identity stays hidden until
both people check in; one member can't read another member's booking; a
regular member can't check anyone in; and venue staff can only check people
in at their own venue.

## How to verify the consumer web app is healthy

A committed Playwright suite drives the real app in a real (headless)
Chrome browser against a real running API, Postgres, and Redis — the same
"no mocks" philosophy as the backend's own end-to-end suite, just one
layer up: it reads the actual rendered page, not the API response
directly.

```bash
# The app under test starts itself (playwright.config.ts's webServer), but
# the API, Postgres, and Redis must already be running — see "Getting the
# backend running" above.

# Important: the frontend suite signs up several members per run, and each
# sign-up requests an OTP. The API's default per-IP limit (3 OTP requests
# per minute) is meant for real users and is too strict for a test run —
# start (or restart) the API with NODE_ENV=test to relax it to 1000/minute
# (this does not point it at a different database; it keeps using whatever
# DATABASE_URL/REDIS_URL your .env already has):
NODE_ENV=test pnpm --filter @kmeets/api start

# Then, in another terminal:
pnpm --filter @kmeets/web test:e2e
```

As of this writing: **5/5 end-to-end tests passing**, run twice in a row
to confirm they're not flaky. Covers the full first-time member journey
(sign up, verify, browse, book, pay, land on a matched meetup), the
secondary screens and the SOS button, the KYC-gate error message, and —
the most safety-critical scenario in the product — two members matched
into the same slot staying mutually anonymous in the rendered page until
both check in, then correctly revealing each other, plus a direct IDOR
check that one member's access token can't read another member's booking.

Remember to restart the API without `NODE_ENV=test` (or just re-run
`pnpm dev:api`) afterwards for normal day-to-day use, so the real OTP
rate limit is back in place.

## How to verify the staff/admin dashboard is healthy

Same idea, same tooling, one more layer up: a committed Playwright suite
drives the real dashboard in a real browser against the real API.

```bash
# Same prerequisite as above — start (or restart) the API with
# NODE_ENV=test first:
NODE_ENV=test pnpm --filter @kmeets/api start

# Then, in another terminal:
pnpm --filter @kmeets/staff test:e2e
```

As of this writing: **5/5 end-to-end tests passing**, run twice in a row.
Covers: a regular member account being turned away with a clear message
when it tries to sign in here; an admin creating a venue and verifying its
CCTV through the real form; two members getting matched and showing up on
the check-in roster identified only by their reference code (never a
name), with checking them in through the real dashboard correctly
triggering the identity reveal once both have arrived; an SOS alert
appearing, being acknowledged, and resolved; and a filed report appearing
in the moderation queue and being resolved with a strike-free resolution
note.

One extra gotcha worth knowing, specific to this suite: the seeded admin
account's phone number is fixed (there's only one seeded admin), and the
API also enforces a *second*, database-persisted OTP-request limit per
phone number (5/hour) that `NODE_ENV=test` does **not** relax — unlike the
in-memory per-IP throttle, this one survives an API restart. Signing in as
the admin through the real login screen on every test would exhaust it
within a handful of runs. So this suite signs the admin in directly (via
the same Redis/verify-endpoint backdoor `e2e/helpers.ts` uses for fixture
accounts, writing the resulting tokens straight into the browser's
storage) for every test except the one that's actually testing the login
screen itself. If you ever see `OTP verify failed` or a stuck "Enter the
code" screen when testing sign-in as the seeded admin by hand, this is
almost certainly why — check `otp_request_log` for that phone number.

## Current status

**Done and tested:** the backend API — accounts and login (phone OTP),
profiles, KYC submission, venues, slot booking, mock payments (plus
signature-verified Razorpay webhook handling, ready for a real account),
the automatic matching engine, check-in and identity reveal, reviews,
reporting and the three-strike moderation system, SOS alerts, and admin
tools. All of it is covered by automated tests, all passing.

**Also done and tested:** the consumer web app (`apps/web`) — every member
screen (sign in, onboarding, KYC, venue browsing, booking + mock payment,
meetups with the hidden→revealed match view, reviews, reports, SOS,
community events). Covered by a committed, automated Playwright suite (not
just "it compiles") that drives a real browser against the real API —
see "How to verify the consumer web app is healthy" above — including the
exact scenario that matters most: two members booking overlapping slots,
staying anonymous to each other in the app until both check in, and only
then seeing each other's name — confirmed by reading the actual rendered
page, not just the API response.

**Also done and tested:** the staff/admin dashboard (`apps/staff`) — a
separate app, gated by role, for venue staff and K-Meets operations. Venue
staff see a check-in roster for their venue and confirm arrivals there
(members and staff match each other up by a short reference code, not a
name — see "How check-in identifies people" below); Trust & Safety handle
the reports queue and SOS alerts; Super Admins additionally create venues,
verify their CCTV, assign staff, and see a plain metrics overview.
Covered by a committed, automated Playwright suite — see "How to verify
the staff/admin dashboard is healthy" above — driving the real flow: a
member account being turned away at the door, a venue being created and
CCTV-verified, two members getting matched and checked in through the
roster (with the reveal actually triggering), an SOS alert being
acknowledged and resolved, and a report being filed and resolved.

**Also done:** a full security audit against the Master Instruction's
checklist — authentication, authorization, input handling, dependency
vulnerabilities, and more. Several real issues were found and fixed (each
with a new automated test); the full list, plus what's deliberately
deferred and why, is in `docs/SECURITY_AUDIT.md`.

**Not started yet:** nothing from the original MVP scope — the next phase
is a UI/UX refinement pass and, once you've registered a company and
opened vendor accounts, the deployment work in `docs/DEPLOYMENT.md`. See
`docs/build-plan.html`'s Implementation Roadmap for the full picture.

## How check-in identifies people

Venue staff never see a member's name before check-in — showing staff a
name to match against would leak identity through the back door the same
anonymity mechanic protects everywhere else. Instead, every booking has a
short reference code (the first 8 characters of its ID, e.g. `886FCE1B`),
shown to the member on their meetup detail screen and to staff on the
check-in roster. In person, a member reads their code out (or shows their
screen) and staff tap "Check in" next to the matching row.

## Where to go next

- `docs/build-plan.html` — the full product and technical plan (features,
  user roles, database design, security plan, roadmap).
- `docs/ENVIRONMENT.md` — what every configuration value in `.env` means.
- `docs/DEPLOYMENT.md` — how to put this on the internet, and how to switch
  each mock provider over to a real vendor account.
- `docs/SECURITY_AUDIT.md` — the full security review: what was checked,
  what was fixed, and what's deliberately deferred and why.
- `docs/TROUBLESHOOTING.md` — fixes for the errors you're most likely to hit
  running this locally.
