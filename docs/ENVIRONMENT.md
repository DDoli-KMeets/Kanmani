# Environment variables

Every setting the backend needs lives in `apps/api/.env` (your real,
private copy — never committed to Git) and is documented with comments in
`apps/api/.env.example` (the template that *is* committed, with no real
secrets in it). This file explains each group in more depth than a one-line
comment allows.

If you're not sure whether a value is a secret: if leaking it would let
someone impersonate K-Meets, spend real money, or read private user data,
it's a secret. Secrets go in `.env`, never in code, never in a message to
anyone outside the small group who needs them, and never committed to Git.

## Server

| Variable | Meaning |
|---|---|
| `PORT` | Which network port the API listens on. `4000` locally; your hosting provider usually sets this for you in production. |
| `NODE_ENV` | `development` on your machine, `test` for the automated test suite, `production` once deployed. Some behavior changes based on this — for example, login rate limits are relaxed automatically in `test` so the test suite doesn't trip them. |
| `CORS_ORIGINS` | Comma-separated list of frontend URLs allowed to call this API from a browser (a security control — without it, any website could make signed-in requests using a member's session). Defaults to the two local dev apps' addresses if unset. In production, set this to your deployed `apps/web` and `apps/staff` URLs. |

## Database

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Where to find Postgres, in one string: `postgresql://<username>:<password>@<host>:<port>/<database-name>`. Locally this points at the Postgres you started with Docker or installed natively. In production, your hosting provider (see `DEPLOYMENT.md`) gives you this value when you create a managed database. |

## Redis

| Variable | Meaning |
|---|---|
| `REDIS_URL` | Where to find Redis, e.g. `redis://localhost:6379`. Redis is used for two things: briefly holding login codes (OTPs) while a member types them in, and running the background "matching engine" that pairs members up after payment. |

## Auth (login sessions)

| Variable | Meaning |
|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Two separate random strings used to cryptographically sign a member's login session, so the server can tell a real session token from a forged one. **Generate your own with `openssl rand -hex 32`, once per environment** (one value for dev, a different one for production) — never reuse the example placeholder values anywhere real, and never let these two secrets be the same value. |
| `JWT_ACCESS_TTL` | How long a "you're logged in" token stays valid before the app has to quietly refresh it (`15m` = 15 minutes). Short on purpose — it limits the damage if one ever leaked. |
| `JWT_REFRESH_TTL` | How long a member can go without re-entering their phone OTP (`30d` = 30 days). |

## Swappable providers (SMS, KYC, Payments, Push)

Each of these four services has a `..._PROVIDER` variable that picks which
implementation runs, plus vendor-specific keys used only when that
provider is set to the real vendor's name. See the "Every external service
is swappable" section of `docs/README.md` for why this pattern exists.

### SMS / login codes

| Variable | Meaning |
|---|---|
| `SMS_PROVIDER` | `mock` (prints the code to the server log instead of texting it — the default until you have a vendor account) or `msg91`. |
| `MSG91_AUTH_KEY`, `MSG91_SENDER_ID` | From your MSG91 account dashboard once you sign up. Ignored while `SMS_PROVIDER=mock`. |

### KYC (identity verification)

| Variable | Meaning |
|---|---|
| `KYC_PROVIDER` | `mock` (automatically approves every submission after a few seconds, for development) or `digio`/`signzy`. |
| `DIGIO_CLIENT_ID`, `DIGIO_CLIENT_SECRET` | From your Digio account once you sign up. Ignored while `KYC_PROVIDER=mock`. |

### Payments

| Variable | Meaning |
|---|---|
| `PAYMENT_PROVIDER` | `mock` (simulates a successful payment instantly, no real money moves — the default) or `razorpay`. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | From your Razorpay merchant dashboard once your company is registered and the account is approved. |
| `RAZORPAY_WEBHOOK_SECRET` | A separate secret Razorpay gives you specifically for verifying that a "payment succeeded" notification really came from Razorpay and not an attacker. The code that checks this (`apps/api/src/integrations/payments/razorpay-payment.provider.ts`) is already written and unit-tested, even though there's no live account to test it against yet. |

### Push notifications

| Variable | Meaning |
|---|---|
| `PUSH_PROVIDER` | `mock` (logs instead of sending) or `firebase`. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | From a Firebase project's service-account credentials once one is set up. |

### File storage

| Variable | Meaning |
|---|---|
| `STORAGE_PROVIDER` | `local` (saves files to disk on the server — fine for development, not for production) or `s3`. |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | From an AWS account and S3 bucket once one is created. |

## The consumer web app's environment

`apps/web` has its own, much smaller `.env.example`. Copy it to
`.env.local` (Vite loads that filename automatically, and it's git-ignored
the same way `.env` is):

| Variable | Meaning |
|---|---|
| `VITE_API_BASE_URL` | The API's address, including `/v1` — e.g. `http://localhost:4000/v1` locally, `https://api.kmeets.in/v1` in production. If unset, it defaults to the local address, so this only needs setting when deploying or pointing at a non-default API URL. |

## The staff/admin dashboard's environment

`apps/staff` has the same `VITE_API_BASE_URL` variable as `apps/web`, in
its own `.env.example` — copy it to `.env.local` there too. Since the two
apps run on different ports (5173 for members, 5174 for staff — see
`CORS_ORIGINS` above) and are meant to be deployed as separate sites, they
each get their own environment file rather than sharing one.

## `.env.test`

`apps/api/.env.test` is a second, already-filled-in environment file used
only by the automated test suite. It points at a separate `kmeets_test`
database (so tests never touch your real development data) and forces
every provider to `mock` (so tests never accidentally send a real SMS or
touch a real vendor account). You shouldn't need to edit it.

## A rule of thumb for adding a new variable later

If a future feature needs a new secret or setting: add it to
`.env.example` with a plain-language comment (never the real value), add
the real value to your own `.env` (never committed), and add a row to the
matching table in this file. Keeping all three in sync is what makes this
document trustworthy to come back to later.
