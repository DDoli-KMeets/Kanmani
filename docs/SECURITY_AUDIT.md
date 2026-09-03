# Security audit — September 2026

Written for a non-technical founder. This is a plain-language record of a
full pass through the security checklist in the Master Instruction (§33):
what was checked, what was found, what was fixed, and what's deliberately
left for later with the reason why. Nothing here is marketing — where
something is still a risk, it says so.

**Bottom line: no CRITICAL issues remain open.** Two issues that started
CRITICAL were found and fixed (below), each with a new automated test that
now runs on every future change to make sure it can't silently come back.

## How to read this

Findings are ranked CRITICAL, HIGH, MEDIUM, or LOW — how bad it would be if
someone actually exploited it, not how likely that is. For each one: what it
was, what could have gone wrong, and what was done about it. "Fixed" means
changed and covered by a new automated test that fails if the problem
returns. "Deferred" means it's real but low-risk enough, or blocked on
something outside this codebase (a hosting decision, a paid vendor
contract), that it's better to note clearly than to rush.

## Fixed this pass

### 1. A banned or suspended account could keep using the app — CRITICAL, fixed

**What it was.** Trust & Safety can ban or suspend a member's account. But
that status was only checked at the moment someone logged in. Once a member
had a valid access token in hand, banning them didn't do anything — the app
kept honoring that token for up to 15 minutes (its normal expiry), and if
they simply logged in again with a *fresh* code, nothing stopped that
either, because login itself never checked the account's status.

**What could have gone wrong.** This is the app's safety-report system's
entire point — Trust & Safety needs to be able to cut someone off. A gap
here means a banned user (say, someone reported for harassment at a venue)
could keep booking meetups and showing up to them after being banned.

**What was fixed.** Two things, so there's no single point of failure:
- Logging in now checks the account's status and refuses to issue a token
  to a banned or suspended account, with a clear message.
- Every single request now re-checks the account's status against the
  database — not just at login — so a ban takes effect immediately, even
  for someone who is mid-session with a token that hasn't expired yet.

**Proof it works.** A new automated test creates an account, bans it, and
confirms both that it can't log back in and that a token issued *before*
the ban stops working right away.

### 2. Free unlimited guesses at someone's login code — CRITICAL, fixed

**What it was.** Logging in sends a 6-digit code by SMS. There was a limit
on how often someone could *request* a new code (to stop spamming a
stranger's phone), but no limit on how many times someone could *guess* the
code for one already-sent request. A 6-digit code only has a million
possibilities — not enough to be safe against unlimited guessing.

**What could have gone wrong.** Someone who knew or guessed a member's phone
number could script repeated guesses against that one login attempt and,
with enough tries, log in as that person — reading their bookings, their
matches, everything the app protects behind login.

**What was fixed.** After 5 wrong guesses in a row for one phone number, that
code is immediately invalidated (the member has to request a fresh one).
This sits alongside the existing per-phone and per-device request limits, so
there are now three independent layers rather than one.

**Proof it works.** A new automated test enters 5 wrong codes in a row and
confirms the 6th attempt — even with the *correct* code — is rejected.

### 3. A member could be booked into a meetup without confirming they're an adult — HIGH, fixed

**What it was.** K-Meets is adults-only by design — it arranges in-person
meetups with strangers. The 18-and-over check existed on the profile-editing
screen, but only ran *if* someone actually filled in their birthdate there.
Skipping that field entirely meant the check never ran, and nothing at the
actual booking step re-confirmed it.

**What was fixed.** The booking step itself — the actual point where a
meetup gets locked in — now independently checks for a valid, on-file
birthdate showing the member is 18 or older, and refuses the booking with a
clear explanation if not. This is "defense in depth": even if a future
change to the profile screen reintroduced this gap, booking would still
catch it.

**Proof it works.** A new automated test verifies a member's ID (KYC) but
never sets a birthdate, then confirms the booking is rejected.

### 4. Emergency SOS alerts weren't scoped to the right venue staff — HIGH, fixed

**What it was.** The in-app panic button (SOS) lets a member alert staff if
something feels wrong during a meetup. Two gaps here:
- Any venue's staff could see and act on *every* venue's SOS alerts, not
  just their own venue's. A staff member at Venue A could resolve — or
  simply never notice — an emergency at Venue B.
- The SOS request let the app itself say which booking/venue the alert was
  for, rather than the server checking that the alert actually belonged to
  the person triggering it. This is the same category of bug as #5 below,
  in a place where getting it wrong matters most.

**What was fixed.** Staff now only see and can act on SOS alerts for venues
they're actually assigned to (Trust & Safety and Super Admin, whose job is
platform-wide safety, still see everything, as intended). The server now
independently verifies a claimed booking really belongs to the person
triggering the alert before trusting it.

**Proof it works.** Two new automated tests: one proves a Venue A staff
account cannot see or resolve a Venue B alert while Trust & Safety can see
both; another proves a fabricated booking reference on an SOS trigger is
ignored rather than trusted.

### 5. One member could look up another member's private data by guessing an ID — MEDIUM, fixed (as part of #4)

This is the general version of #4's second bullet: any place that trusts an
ID sent by the app itself, instead of independently checking it belongs to
whoever's asking, is a risk (this class of bug is called IDOR — "insecure
direct object reference"). The SOS module was the one place this pattern was
found and it's now fixed there specifically; every other place a booking,
venue, or user ID is looked up (reviewing a match, checking in, viewing a
report) was checked and already does this correctly — each has its own
automated test proving it (see `docs/README.md`'s testing section).

### 6. A weak or forgotten production secret could go live silently — HIGH, fixed

**What it was.** The app signs login tokens with two secret keys. If one of
those keys were ever missing, too short, left as the placeholder value from
the example config file, or accidentally set to the *same* value as the
other key, every login token becomes forgeable or guessable — and nothing
would have stopped the app from starting up anyway.

**What was fixed.** The app now refuses to start in production at all if
either key is missing, weak, still a placeholder, or identical to the other
one. The same startup check also refuses to start if the SMS, ID-verification
(KYC), or payment integration is still set to its free "mock" version — the
mock payment provider marks every booking paid for free, and the mock KYC
provider auto-approves every ID with no real check, so shipping either by
accident would be serious. Folded into the same fix because it's the same
category of risk: "a forgotten environment variable during a rushed deploy."

**Proof it works.** A dedicated set of automated tests feeds this check every
unsafe combination (missing secret, short secret, placeholder secret,
duplicate secret, each mock provider) and confirms every one is caught.

### 7. A known SQL-injection vulnerability in a library the app depends on — HIGH, fixed

**What it was.** A routine dependency scan (`pnpm audit`) flagged a
published vulnerability in Drizzle, the library the app uses to talk to the
database. In the vulnerable pattern, a program that builds SQL column/table
names dynamically from outside input can have that input used to inject
extra SQL.

**Checked, not just assumed.** K-Meets' database code never builds
column/table names dynamically from anything a user sends — every query
filter goes through Drizzle's safe, parameterized query-building functions.
So this specific vulnerability's exploit path doesn't actually exist in this
app's code. It was upgraded anyway, because there's no reason not to run
patched software, and the full test suite (23 backend unit tests, 18
end-to-end tests, plus both frontend test suites) was re-run afterward and
passed cleanly — confirming the upgrade itself introduced no breakage.

### 8. Outdated dependencies with published vulnerabilities — mostly fixed

A routine scan (`pnpm audit`) started at 17 known vulnerabilities in
production-relevant dependencies (6 high, 10 moderate, 1 low). After
upgrading Drizzle (#7 above) and its matching companion tool, removing one
unused dependency (`uuid` — installed but never actually used anywhere in
the code, so removing it removed its vulnerability along with it for free),
and pinning three more dependencies that are bundled *inside* other
libraries to their already-published fixed versions (a technique called an
"override" — it doesn't change what the app does, only which exact version
of a helper library it uses internally), **14 of the 17 were resolved.** The
full test suite was re-run after every change and stayed green throughout.

## Deferred, with reasons

### A. One moderate vulnerability in the web framework itself (NestJS)

The backend framework has a moderate-severity fix available, but only in its
next major version (v11) — it isn't available as a patch to the version this
app is built on (v10). Upgrading a major framework version is a real project
of its own (breaking changes, a full regression pass) and isn't something to
fold quietly into a security-hardening pass. Recommendation: plan a dedicated
NestJS v11 upgrade as its own piece of work sometime after launch, not
urgently before it — this is a moderate-severity issue with no evidence of
an active, easy exploit against this app's actual usage pattern.

### B. Two moderate vulnerabilities in React Router (used by both apps)

Both advisories are fixed only in React Router's next major version (v7 —
this app uses v6). One of the two only affects apps that render pages on the
server first ("SSR"); K-Meets' apps are pure in-browser apps and don't do
that, so it doesn't apply here at all. The other is about untrusted web
addresses being passed to the app's internal navigation — checked directly:
every navigation in both apps only ever uses fixed screen names or the
app's own booking/venue/user IDs, never a raw address typed by a user or
pulled from an outside link. Same conclusion as the Drizzle case above: the
vulnerable pattern doesn't exist in this app's code. Deferred for the same
reason as NestJS — a major-version upgrade of a core library is planned
work, not an emergency patch.

### C. Database and cloud hosting permissions, and which network services are exposed

These are configuration decisions that only make real sense once there's an
actual hosting provider, database, and cloud account to configure — none of
which exist yet (no company registered, no vendor accounts opened, per your
own standing decision). The code is already written to make the *safe*
choice easy: it never hard-codes credentials, reads all connection details
from environment variables, and (per fix #6 above) now refuses to boot in
production with dangerous defaults. When you're ready to actually deploy,
`docs/DEPLOYMENT.md` is where the specific hosting checklist belongs — the
short version to remember then: the database user the app connects with
should only have the permissions it actually needs (not a full admin
account), and only the web app's own address should ever be reachable from
the internet — the database and Redis should not be.

## Reviewed and already solid (no changes needed)

Checked directly, not assumed:

- **SQL injection** — every database query goes through parameterized
  queries; grepped the whole codebase for any place that builds a query
  from raw string concatenation, and there isn't one.
- **Cross-site scripting (XSS)** — both frontend apps use React, which
  escapes everything it renders by default; grepped for any place that
  bypasses that (`dangerouslySetInnerHTML` or similar), and there isn't one.
- **Path traversal / arbitrary file access** — there's no file-upload or
  file-serving feature in the app yet, so there's no surface for this at
  all right now.
- **CSRF (cross-site request forgery)** — this only matters for apps that
  use browser cookies to stay logged in; K-Meets uses a login token sent
  explicitly in each request instead (never a cookie), which is inherently
  not vulnerable to this category of attack.
- **Input validation** — every piece of data the API accepts is checked
  against a strict, explicit set of rules before anything happens with it,
  and anything not on that explicit list is rejected outright rather than
  silently ignored.
- **Authorization / role checks** — every screen and action was checked
  against who's actually allowed to see or do it (a plain member can't
  reach staff or admin actions, staff can't reach Trust-&-Safety/Super-Admin
  actions like banning someone or changing roles), and role changes
  themselves are locked to Super Admin only.
- **Rate limiting** — every endpoint has a general limit against being
  hammered, with a much tighter limit specifically on the login-code
  request endpoint (see fixes #1 and #2 above for the deeper layers there).
- **CORS and security headers** — the API only accepts browser requests from
  the app's own known addresses, and sends the standard set of protective
  browser headers (via a well-established library called Helmet) on every
  response.
- **Error messages** — checked that a failure never sends back a raw
  database error, file path, or stack trace to the app — only a clean,
  human-readable message. Full technical detail is still logged on the
  server for debugging, just never sent over the network.
- **Logging** — checked that login codes, tokens, and full profile details
  are never written to logs in a real (non-mock) setup; phone numbers and
  IDs are logged for legitimate incident-investigation reasons (e.g. "who
  triggered this SOS alert"), which is normal and expected.
- **Oversized requests** — the API now has an explicit, documented 1MB cap
  on request size, so it can't be sent an enormous request as a nuisance.

## What this audit doesn't cover

This was a code-level security review — the kind that lives entirely in
this repository. It does not cover, because none of it exists yet: the
actual hosting/cloud setup, a penetration test by an outside security firm,
or a legal/compliance review (data-protection law, terms of service, KYC
provider contracts). Those are the right next steps once there's a company
and vendor accounts to build them around — not something to skip, just not
something that can be done from inside this codebase today.
