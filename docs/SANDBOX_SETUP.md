# Sandbox setup — a free, mock-data test deploy

This is the "let me click around in a real browser" version of K-Meets —
live on the internet, but running entirely on free hosting tiers with
every third-party provider (SMS, KYC, payments) still mocked, exactly like
local development. It's for trying the product out and showing it to
people, not for real users or real money. See `docs/DEPLOYMENT.md` for the
real-launch path once the company is registered and vendor accounts exist
— that's a separate, deliberately different blueprint (`render.yaml`, not
`render.sandbox.yaml`), so the two never get mixed up.

**What "free" means here, honestly:**

- No credit card needed anywhere in this walkthrough.
- The API sleeps after 15 minutes with no visitors and takes about a
  minute to wake back up on the next request — the first tap after a
  quiet spell will feel slow. That's normal, not broken.
- The database (Neon) is a genuinely permanent free tier — it doesn't
  expire, unlike Render's own free Postgres (which is deleted 30 days
  after creation).
- Redis (login codes + the matching queue) does *not* survive a restart
  on the free plan. If a login code stops working, just request a new
  one — nothing else is lost.
- One real limit worth knowing: 3 login-code requests per hour per phone
  number, same as production. Plenty for testing, but don't spam "Send
  code."

## What you'll need

Three free accounts — roughly 15-20 minutes total:

1. **GitHub** — hosts the code Render deploys from. Skip if you already
   have one.
2. **Neon** (neon.com) — the database.
3. **Render** (render.com) — runs the three apps.

## Step 1 — Get the code onto GitHub

Render deploys from a Git repository, so the code needs to live on GitHub
first. Tell me once you have a GitHub account (new or existing) and I'll
either push it there directly if you give me a repo to push to, or hand
you the exact three commands to run yourself if you'd rather do it by
hand.

## Step 2 — Create a free Neon Postgres project

1. Go to neon.com → sign up (no card).
2. Create a new project — any name, e.g. `kmeets-sandbox`.
3. On the project's dashboard, copy the **connection string** (Neon calls
   it exactly that). It looks like
   `postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require`.
   Keep this handy for Step 4.

## Step 3 — Create a free Render account

1. Go to render.com → sign up (no card).
2. Connect your GitHub account when prompted, and give it access to the
   repo from Step 1.

## Step 4 — Deploy the Blueprint

1. Render dashboard → **New → Blueprint**.
2. Pick the GitHub repo from Step 1.
3. Under advanced/blueprint settings, set **Blueprint Path** to
   `render.sandbox.yaml` (Render looks for plain `render.yaml` by
   default — this repo has both, and the sandbox one is what keeps this
   deploy free).
4. Render shows every resource it's about to create (one Redis instance,
   three web services) and asks for the one value marked "provide during
   deploy": **DATABASE_URL** — paste in the Neon connection string from
   Step 2 here.
5. Click **Deploy Blueprint**. Each service takes a few minutes to build
   the first time — the dashboard shows live logs.

## Step 5 — Note the real URLs, fix cross-references

`render.sandbox.yaml` guesses each service's URL will be
`kmeets-api.onrender.com` / `kmeets-web.onrender.com` /
`kmeets-staff.onrender.com` — but `.onrender.com` names are shared across
every Render user, so if any of those three are already taken, yours will
get a random suffix instead (e.g. `kmeets-api-a1b2.onrender.com`). Once
all three services are up:

1. Note each service's actual URL from the Render dashboard.
2. If any of them differ from the guess above, update two things and
   redeploy:
   - `kmeets-api` → Environment tab → `CORS_ORIGINS` → the real
     `kmeets-web` and `kmeets-staff` URLs, comma-separated.
   - `kmeets-web` and `kmeets-staff` → Environment tab → `VITE_API_BASE_URL`
     → the real `kmeets-api` URL + `/v1` (e.g.
     `https://kmeets-api-a1b2.onrender.com/v1`). Vite bakes this in at
     build time, so each change needs a **Manual Deploy**, not just a
     restart.

If all three names came through exactly as guessed, skip this step.

## Step 6 — Set up the database (once)

`kmeets-api`'s dashboard page → **Shell** tab → run, one at a time:

```
node dist/src/database/migrate.js
node dist/src/database/seed.js
```

The second command creates a starting admin account
(`+91 99999 99999`) and a handful of interests. Don't use
`pnpm --filter @kmeets/api db:migrate` here — that only works in local
dev; this deployed copy of the app doesn't have the tool it needs
(ts-node), only the already-compiled version these two commands run.

## Step 7 — Try it

Open `kmeets-staff`'s URL first:

1. Sign in with `9999999999` (the seeded admin). Since this is sandbox
   mode, the login screen shows the code directly instead of texting it —
   no separate step to find it.
2. **Venues → add a venue**, then mark it CCTV-verified (members never
   see an unverified venue).

Then open `kmeets-web`'s URL in another tab (or your phone):

3. Sign in with any other 10-digit number starting 6-9 — it doesn't need
   to be real, this is sandbox data.
4. Fill in the profile + KYC steps (KYC auto-verifies after a few
   seconds — mock, same as local dev).
5. Browse to the venue you created, book a slot, "pay" (mock checkout).
6. Back in the staff app's **Check-in** screen, check that booking in.
   Book a second overlapping slot with a third phone number and check
   both in to see the match reveal.

## When you're ready for real users

This sandbox stays exactly what it is — a free demo — until the two
things only you can do happen: registering the company, and getting the
Terms of Service / Privacy Policy reviewed by a lawyer (DPDPA). From
there, `docs/DEPLOYMENT.md`'s "Switching a provider from mock to real"
walks through turning on real SMS/KYC/payments one at a time, and
`render.yaml` (not this sandbox file) is the blueprint for that real
deploy, on paid plans that don't sleep or expire.
