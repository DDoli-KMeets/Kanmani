# Troubleshooting

Fixes for the errors you're most likely to run into working with this
repository. If something isn't here, the error message itself is usually
the best next clue — most of these are Postgres, Redis, or Node reporting a
very literal problem ("I can't connect", "this port is taken").

## "Cannot connect to database" / `ECONNREFUSED` on migrate or start

Postgres isn't running, or `DATABASE_URL` in `apps/api/.env` doesn't match
where it's actually running.

- If you started Postgres with the Docker command in `docs/README.md`,
  confirm it's still running: `docker ps` should list `kmeets-postgres`.
  If it's not there, start it again with the same `docker run` command (or
  `docker start kmeets-postgres` if it already exists but is stopped).
- Double-check `DATABASE_URL` in `.env` matches the username, password,
  host, port, and database name you actually set up.

## "Cannot connect to Redis" / `ECONNREFUSED` on port 6379

Same idea as above, for Redis. Confirm `docker ps` shows `kmeets-redis`
running, and that `REDIS_URL` in `.env` points at the right host/port.

## `relation "users" does not exist` (or any "relation ... does not exist")

The database is reachable, but its tables haven't been created yet. Run:

```bash
pnpm --filter @kmeets/api db:migrate
```

This applies every migration under `apps/api/src/database/migrations` to
whichever database `DATABASE_URL` points at.

## Port `4000` (or `5432`, or `6379`) already in use

Something else on your machine is already using that port — often a
previous run of the same service that didn't shut down cleanly.

- For the API itself: either stop whatever's using port 4000, or change
  `PORT` in `.env` to a free port (e.g. `4001`).
- For Postgres/Redis started via Docker: `docker ps` will show if an old
  container is still running; `docker stop kmeets-postgres` (or
  `kmeets-redis`) frees the port.

## OTP login codes aren't arriving

This is expected in development. With `SMS_PROVIDER=mock` (the default),
no real SMS is sent — the code is printed to the terminal where the API is
running (look for a line mentioning the phone number). Real SMS delivery
only starts once `SMS_PROVIDER` is switched to a real vendor, which needs a
registered company and a vendor account — see `docs/DEPLOYMENT.md`.

## `429 Too Many Requests` when requesting an OTP

Two separate safety limits can produce this, and they behave differently —
worth telling apart:

- **Per-IP, in-memory** (3 requests/minute by default) — meant to slow down
  someone hammering the endpoint from one place. Resets whenever the API
  process restarts, and is relaxed to 1000/minute automatically when
  `NODE_ENV=test` (see `OTP_REQUEST_LIMIT` in
  `apps/api/src/modules/auth/auth.controller.ts`) — which is why the
  backend's own `test:e2e` suite never hits it, and why the frontend
  Playwright suites (`apps/web`, `apps/staff`) need the API started with
  `NODE_ENV=test` too (see docs/README.md's "How to verify the consumer
  web app / staff dashboard is healthy").
- **Per-phone-number, database-persisted** (5 requests/hour, stored in the
  `otp_request_log` table) — a real safety limit so the endpoint can't be
  used to spam one person's phone. This one does **not** care about
  `NODE_ENV` and does **not** reset on restart — it survives until an hour
  has passed. It's the one you'll actually hit doing repeated manual
  testing against a fixed number (the seeded admin's phone, `+919999999999`,
  is the usual victim). Fix: wait, use a different phone number, or — for
  local dev/test data only, never in production — delete the stale rows:
  `DELETE FROM otp_request_log WHERE phone = '+919999999999';`.

The staff dashboard's Playwright suite (`apps/staff/e2e`) exists specifically
because this limit isn't test-mode-relaxed: it signs the seeded admin in
directly (bypassing the login screen's OTP request entirely, via the same
Redis/verify-endpoint backdoor used for fixture accounts) for every test
except the one that's actually testing the login screen, so a normal test
run never touches this limit at all.

## The end-to-end test suite (`test:e2e`) hangs or times out

Almost always means it can't reach Postgres or Redis — check both are
running the same way as the two connection-refused sections above, but
using `apps/api/.env.test` (a separate config from `.env`, pointing at the
`kmeets_test` database) rather than `.env`.

If both are confirmed running and it still hangs specifically at the very
end (all tests show as passed, but the process doesn't exit): this is a
known, harmless quirk with how one of the background job libraries closes
its connections during test teardown. The `test:e2e` script already
includes `--forceExit` to handle this automatically; if you're running
Jest directly with a different command, add `--forceExit` to it.

## The app runs, but a route/feature you know exists returns a 404 or 500

If you're running the API with `pnpm start` (the built, production-style
`dist/src/main.js`) rather than `pnpm dev` (`nest start --watch`, which
recompiles automatically), a `dist/` build made before the latest backend
changes will keep serving the old code — new endpoints will 404, and
changed ones can 500 in confusing ways. Rebuild and restart:

```bash
pnpm --filter @kmeets/api build
pnpm --filter @kmeets/api start
```

`pnpm dev` doesn't have this problem — it watches `src/` directly — so for
day-to-day development, prefer `pnpm dev:api` over `pnpm start`.

## `npx tsc --noEmit` or the build reports type errors after pulling new code

Someone else's changes may depend on a package version you don't have yet.
Run `pnpm install` from the repo root to sync every workspace's
dependencies, then try again.

## Nothing here matches what you're seeing

Two things worth trying before anything else:

1. `pnpm install` from the repo root — covers most "works on one machine,
   not another" problems.
2. Re-read the exact error message once more, slowly — Node/Postgres/Redis
   error messages are usually more literal than they first appear (e.g.
   "password authentication failed" really does mean the password in your
   `.env` doesn't match what the database expects).

If it's still unclear, that's a reasonable point to paste the exact error
message into a conversation here for help diagnosing it.
