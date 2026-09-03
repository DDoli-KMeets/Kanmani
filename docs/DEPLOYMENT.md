# Deployment

This describes how to put K-Meets on the internet, and separately, how to
switch each mock third-party provider over to a real vendor once accounts
exist. Nothing here needs to happen before the apps are finished — treat it
as a reference for when that day comes, not a checklist to work through now.

**Just want to click around in a live sandbox first, on mock providers,
for free?** See `docs/SANDBOX_SETUP.md` instead — everything below is
about the real, paid, real-vendor launch.

## Before deploying anything: two things only a person can do

An AI assistant can write and test code, but it cannot register a company,
sign a contract, or agree to a vendor's terms of service on your behalf.
Two things need to happen first, done by you (or your lawyer/accountant):

1. **Register the company.** Most Indian payment and KYC vendors (Razorpay,
   Digio, etc.) require a registered business entity, a business bank
   account, and GST/PAN details before they'll approve a merchant account.
2. **Get legal review of the Terms of Service, Privacy Policy, and data
   handling practices**, specifically around India's Digital Personal Data
   Protection Act (DPDPA), before real user data (especially KYC documents
   and phone numbers) is collected in production. This was flagged in
   `docs/build-plan.html`'s Security Plan section and hasn't changed: an AI
   assistant cannot certify legal compliance, only a qualified lawyer can.

Everything below can be prepared in advance; going live for real is gated
on those two.

## Hosting the API

The backend (`apps/api`) is a standard NestJS (Node.js) application. It
needs: a place to run the Node process, a managed Postgres 16 database, and
a managed Redis 7 instance. Reasonable options, roughly ordered by how much
setup they require:

- **Railway** or **Render** — simplest. Both offer one-click managed
  Postgres and Redis, and deploy a Node app straight from a GitHub
  repository with minimal configuration. Good fit for K-Meets' current
  scale and team size.
- **AWS** (via ECS/Fargate + RDS + ElastiCache) — more control, more setup
  work, worth it once traffic or compliance needs outgrow the simpler
  options.

Whichever host is chosen, the deployment steps are the same shape:

1. Provision a Postgres 16 database and a Redis 7 instance.
2. Set every environment variable from `docs/ENVIRONMENT.md` in the
   hosting provider's dashboard (never commit real secrets to Git).
   `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be freshly generated
   for production — never the same values used in development.
3. On each deploy: run `pnpm install`, then `pnpm --filter @kmeets/api
   build`, then `pnpm --filter @kmeets/api db:migrate` (applies any new
   database changes), then start the server with `pnpm --filter
   @kmeets/api start`.
4. Point the domain (e.g. `api.kmeets.in`) at the hosted service, with
   HTTPS enabled — most of the hosts above do this automatically.

### The one-command path: Docker + `render.yaml`

Steps 1-3 above are already packaged so a host doesn't need to be told each
one by hand:

- **`apps/api/Dockerfile`**, **`apps/web/Dockerfile`**, **`apps/staff/Dockerfile`**
  — multi-stage builds (a small dependency-installing stage, a build stage,
  a lean production-only runtime stage) for each of the three apps. Built
  from the repo root as the Docker build context — see the usage comment
  at the top of each Dockerfile.
- **`docker-compose.yml`** — runs the whole stack together (Postgres,
  Redis, a one-shot migration step, a one-shot seed step, and all three
  apps) for local testing of the production images before they go anywhere
  real. `docker compose up --build` from the repo root.
- **`render.yaml`** — a Render Blueprint: pointing Render's "New >
  Blueprint" at this repository provisions the database, Redis, the API
  (as the Docker image above), and both frontends (as static sites) in one
  step, wired together, instead of configuring each by hand. Read the
  comments at the top of the file before using it — it was written by
  reading Render's published schema, not verified against a live Render
  account (none exists yet), so treat it as a strong starting point to
  review, not a guaranteed-correct file.

**Honesty about what's actually been tested:** the sandbox this project was
built in has an allowlisted network — it can reach npm, but not Docker Hub
or any other container registry — so `docker build` has never actually
been run here; the Dockerfiles and compose file have been reviewed
carefully but not executed. `.github/workflows/ci.yml`'s `docker-build`
job is the first real test they get, since GitHub Actions runners have
full internet access — check that job's result before trusting these
files, and treat any failure there as a real bug to fix, not a fluke.

### Continuous integration

`.github/workflows/ci.yml` runs on every push/PR to `main`: lint,
typecheck, the backend's unit tests, a build of all three apps, the
backend's e2e suite (against real Postgres/Redis service containers), both
frontend Playwright suites (against a real running API), and the Docker
image builds described above. This is the automated version of the Master
Instruction's own build process ("run tests, check for errors ... only
then proceed") — a future change that breaks something fails CI, not just
a code review.

### Verifying a deploy actually worked

`scripts/smoke-test.mjs` hits a deployed environment's `/health` endpoint
(confirms the API is up and can actually reach its database and Redis, not
just that the process is running), and optionally exercises the real
sign-up path — OTP request, OTP verify, an authenticated request — end to
end:

```bash
node scripts/smoke-test.mjs --base-url https://api.kmeets.in/v1
# or, for the full flow (only ever against an environment where
# SMS_PROVIDER=mock — see the safety note at the top of the script):
node scripts/smoke-test.mjs --base-url https://api.kmeets.in/v1 --with-auth-flow --redis-url <redis URL>
```

Run this right after any real deploy, before telling anyone it's live.

## Bootstrapping the first production admin

There's no "sign up as admin" button by design — admin access is powerful
(it can create venues, resolve safety reports, ban members) and shouldn't
be self-service. The very first admin account is created the same way it
was in development: connect to the production database directly, through
your hosting provider's database console, and run:

```sql
UPDATE users SET role = 'SUPER_ADMIN' WHERE phone = '+91XXXXXXXXXX';
```

...for your own phone number, after logging in once normally so the row
exists. From then on, that admin can promote others through the admin
dashboard (once `apps/staff` is built) instead of touching the database
directly.

## Switching a provider from mock to real

The pattern is identical for all four services — this walks through
Razorpay (payments) as the example; the others follow the same shape.

1. **Get the account.** Register for a Razorpay merchant account (needs
   the registered company from the section above), complete their
   verification, and get approved.
2. **Get the keys.** From the Razorpay dashboard: a Key ID, a Key Secret,
   and — separately — a webhook secret, generated when you register a
   webhook URL (see next step).
3. **Register the webhook.** In the Razorpay dashboard, add a webhook
   pointing at `https://api.kmeets.in/v1/payments/razorpay/webhook` (your
   real API domain), subscribed to the `payment.captured` event. Razorpay
   gives you a webhook secret at this point — that's
   `RAZORPAY_WEBHOOK_SECRET`.
4. **Set the environment variables** in production:
   `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`.
5. **Redeploy.** The app reads `PAYMENT_PROVIDER` at startup and wires up
   the real implementation instead of the mock one — no code changes
   needed. The webhook-signature-verification code that protects this
   endpoint from forged "payment succeeded" messages
   (`apps/api/src/integrations/payments/razorpay-payment.provider.ts`) is
   already written and already covered by a unit test, so this step is
   genuinely just configuration.
6. **Test with a small real payment** before announcing it's live, the
   same way you'd test any payment integration.

The same five-step shape applies to:

- **SMS**: sign up for MSG91 → get an auth key and sender ID → set
  `SMS_PROVIDER=msg91` plus the two `MSG91_...` variables → redeploy.
- **KYC**: sign up for Digio or Signzy → get client credentials → set
  `KYC_PROVIDER=digio` plus its variables → redeploy.
- **Push notifications**: create a Firebase project → get service-account
  credentials → set `PUSH_PROVIDER=firebase` plus its variables →
  redeploy.

Each of these can be switched over independently and at different times —
there's no requirement to do all four together. Mock stays a perfectly
safe default for any of them that isn't ready yet.

## Deploying the frontend apps

Both `apps/web` (the consumer app) and `apps/staff` (the venue/admin
dashboard) are static sites: `pnpm --filter @kmeets/web build` (or
`@kmeets/staff`) produces a `dist/` folder of plain HTML/CSS/JS with no
server-side rendering needed, which can be hosted on something like
Vercel, Netlify, or Cloudflare Pages. For each app:

1. Set `VITE_API_BASE_URL` (in that host's environment/build settings, or
   an `.env.production` file) to the deployed API's URL, e.g.
   `https://api.kmeets.in/v1`.
2. Build with the command above and deploy the resulting `dist/` folder
   per that host's normal process.
3. Add the deployed URL (e.g. `https://app.kmeets.in`,
   `https://staff.kmeets.in`) to the API's `CORS_ORIGINS` (see
   `docs/ENVIRONMENT.md`) and redeploy the API — without this, the browser
   will block the deployed app from calling the API at all.

Keep `apps/staff` off a public, guessable URL if possible (an
unlisted subdomain, or behind your hosting provider's access controls) —
its own sign-in already restricts it to staff accounts, but there's no
reason to advertise an internal tool's address to the public.

## A basic pre-launch checklist

Before pointing real users at a production deployment for the first time:

- [ ] Company registered; ToS/Privacy Policy reviewed by a lawyer.
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are freshly generated,
      unique to production, and not the same as any development value.
- [ ] Database and Redis are the managed production instances, not the
      development ones.
- [ ] At least the payment provider (and ideally SMS) switched from mock
      to a real vendor, following the steps above.
- [ ] The first `SUPER_ADMIN` account exists (see above).
- [ ] Both automated test suites pass against the production build
      (`docs/README.md` → "How to verify the backend is healthy").
- [ ] `.github/workflows/ci.yml` is green on the commit being deployed —
      including the `docker-build` job, the only real test the Dockerfiles
      get (see "Honesty about what's actually been tested" above).
- [ ] HTTPS is enabled on the API domain (not plain HTTP).
- [ ] `node scripts/smoke-test.mjs --base-url <production API URL>` passes
      right after the deploy, before announcing it's live.
