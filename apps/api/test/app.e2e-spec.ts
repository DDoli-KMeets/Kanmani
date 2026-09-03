import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import request from "supertest";
import { eq } from "drizzle-orm";
import { AppModule } from "../src/app.module";
import { getDb, closeDb } from "../src/database/client";
import { schema } from "../src/database/client";

/**
 * End-to-end coverage of K-Meets' core, safety-critical path: sign up →
 * verify KYC → book a slot → pay → get matched → check in → get revealed —
 * plus the authorization boundaries around it (IDOR, role gates). This is
 * the automated version of the manual walkthrough used to validate the
 * build; keeping it as a real test means a future change that breaks the
 * anonymity boundary or an access check fails CI, not just a code review.
 */
/**
 * Matching runs on a background BullMQ worker, not inline with the payment
 * request — so waiting for it means polling, not a fixed sleep. A fixed
 * sleep either wastes time (padded well past the typical case) or flakes
 * under load (a slow CI runner or a busy dev box pushes the worker past a
 * tight window) — this bit the suite for real once already.
 */
async function waitUntil(check: () => Promise<boolean>, timeoutMs = 10_000, intervalMs = 150) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitUntil: condition not met within ${timeoutMs}ms`);
}

describe("K-Meets core flow (e2e)", () => {
  let app: INestApplication;
  const db = getDb();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await closeDb();
  });

  const phoneA = "+919000000001";
  const phoneB = "+919000000002";
  const phoneStaff = "+919000000003";

  let tokenA: string;
  let tokenB: string;
  let tokenStaff: string;
  let userIdA: string;
  let userIdB: string;
  let userIdStaff: string;
  let venueId: string;
  let bookingAId: string;
  let bookingBId: string;
  let paymentAId: string;
  let paymentBId: string;

  async function otpLogin(phone: string) {
    await request(app.getHttpServer()).post("/v1/auth/otp/request").send({ phone }).expect(200);
    const [row] = await db
      .select()
      .from(schema.otpRequestLog)
      .where(eq(schema.otpRequestLog.phone, phone))
      .orderBy(schema.otpRequestLog.createdAt);
    // The mock SMS provider only logs the code; tests read it straight out
    // of Redis the same way a real OTP flow would look it up server-side.
    // We don't have direct Redis access here, so re-derive it via the
    // service is not possible from an integration boundary — instead we
    // read Redis directly through ioredis, matching how AuthService stores it.
    void row;
    const Redis = (await import("ioredis")).default;
    const redis = new Redis(process.env.REDIS_URL!);
    const code = await redis.get(`otp:${phone}`);
    await redis.quit();
    if (!code) throw new Error(`No OTP found in Redis for ${phone}`);

    const res = await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
    return res.body as { accessToken: string; user: { userId: string } };
  }

  it("logs three members in via phone OTP", async () => {
    const a = await otpLogin(phoneA);
    const b = await otpLogin(phoneB);
    const staff = await otpLogin(phoneStaff);
    tokenA = a.accessToken;
    tokenB = b.accessToken;
    tokenStaff = staff.accessToken;
    userIdA = a.user.userId;
    userIdB = b.user.userId;
    userIdStaff = staff.user.userId;
    expect(tokenA).toBeTruthy();
    expect(userIdA).not.toBe(userIdB);
  });

  it("rejects a wrong OTP code", async () => {
    await request(app.getHttpServer())
      .post("/v1/auth/otp/request")
      .send({ phone: phoneA })
      .expect(200);
    await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ phone: phoneA, code: "000000" })
      .expect(401);
  });

  async function readOtpCode(phone: string): Promise<string> {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis(process.env.REDIS_URL!);
    const code = await redis.get(`otp:${phone}`);
    await redis.quit();
    if (!code) throw new Error(`No OTP found in Redis for ${phone}`);
    return code;
  }

  it("invalidates an OTP after 5 wrong verify attempts, closing the distributed-guessing gap a per-IP throttle alone would miss", async () => {
    const phone = "+919000000004";
    await request(app.getHttpServer()).post("/v1/auth/otp/request").send({ phone }).expect(200);
    const code = await readOtpCode(phone);
    const wrongCode = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post("/v1/auth/otp/verify")
        .send({ phone, code: wrongCode })
        .expect(401);
    }

    // The real code is now burned, even though it hasn't naturally expired.
    await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ phone, code })
      .expect(401);
  });

  it("blocks a banned account from logging back in, and cuts off its already-issued access token immediately", async () => {
    const phone = "+919000000005";
    const first = await otpLogin(phone);

    // Works fine before the ban.
    await request(app.getHttpServer())
      .get("/v1/users/me")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200);

    // Simulates what ModerationService.issueStrike does when Trust & Safety
    // upholds a report with a BAN strike.
    await db.update(schema.users).set({ accountStatus: "BANNED" }).where(eq(schema.users.id, first.user.userId));

    // The access token issued before the ban must stop working immediately
    // — not just once its 15-minute TTL naturally expires. This is what
    // JwtAuthGuard's per-request accountStatus check exists for.
    await request(app.getHttpServer())
      .get("/v1/users/me")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(401);

    // And the banned member can't just log back in for a fresh token either.
    await request(app.getHttpServer()).post("/v1/auth/otp/request").send({ phone }).expect(200);
    const code = await readOtpCode(phone);
    await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ phone, code })
      .expect(403);
  });

  it("rejects requests with no token", async () => {
    await request(app.getHttpServer()).get("/v1/users/me").expect(401);
  });

  it("sets up profiles with an overlapping interest", async () => {
    const [interest] = await db
      .insert(schema.interests)
      .values({ name: `Hiking-${Date.now()}`, category: "outdoors" })
      .returning();

    await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "Aisha",
        dateOfBirth: "1998-04-12",
        gender: "FEMALE",
        relationshipStatus: "SINGLE",
        interestIds: [interest.id],
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch("/v1/users/me")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        name: "Rohan",
        dateOfBirth: "1996-09-03",
        gender: "MALE",
        relationshipStatus: "SINGLE",
        interestIds: [interest.id],
      })
      .expect(200);
  });

  it("rejects a booking before KYC is verified", async () => {
    // Directly promote user A to SUPER_ADMIN to create a venue — bootstrapping
    // the very first admin always requires a manual step (see docs/README.md),
    // exactly like it did in the real dev-server walkthrough.
    await db.update(schema.users).set({ role: "SUPER_ADMIN" }).where(eq(schema.users.id, userIdA));
    const relogin = await otpLogin(phoneA);
    tokenA = relogin.accessToken;

    const venueRes = await request(app.getHttpServer())
      .post("/v1/venues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Test Cafe", addressLine: "MG Road", city: "Hyderabad", tier: "CAFE" })
      .expect(201);
    venueId = venueRes.body.id;
    await request(app.getHttpServer())
      .patch(`/v1/venues/${venueId}/cctv-verify`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/v1/bookings")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ venueId, slotDate: new Date(Date.now() + 3600_000).toISOString(), format: "ONE_ON_ONE" })
      .expect(403);
  });

  it("verifies KYC for both members", async () => {
    await request(app.getHttpServer())
      .post("/v1/kyc/submit")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ documentType: "PAN", videoReference: "mock://a" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/v1/kyc/submit")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ documentType: "PAN", videoReference: "mock://b" })
      .expect(201);

    // Mock KYC provider auto-verifies after ~3s — see MockKycProvider.
    await new Promise((resolve) => setTimeout(resolve, 3500));

    const statusA = await request(app.getHttpServer())
      .get("/v1/kyc/status")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(statusA.body.status).toBe("VERIFIED");
  });

  it("rejects a booking from a KYC-verified account that never set a date of birth", async () => {
    // The 18+ rule (UsersService.updateProfile) only runs when a profile
    // update happens to include a dateOfBirth — an account that skips that
    // field entirely (never onboarded a profile, or was created before
    // this field existed) must still be blocked at the actual point of no
    // return: booking a real, paid, in-person meetup.
    const phoneC = "+919000000007";
    const c = await otpLogin(phoneC);
    await request(app.getHttpServer())
      .post("/v1/kyc/submit")
      .set("Authorization", `Bearer ${c.accessToken}`)
      .send({ documentType: "PAN", videoReference: "mock://c" })
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 3500));

    await request(app.getHttpServer())
      .post("/v1/bookings")
      .set("Authorization", `Bearer ${c.accessToken}`)
      .send({ venueId, slotDate: new Date(Date.now() + 3600_000).toISOString(), format: "ONE_ON_ONE" })
      .expect(403);
  });

  it("books overlapping slots, pays, and gets auto-matched", async () => {
    const slotA = new Date(Date.now() + 3 * 3600_000).toISOString();
    const slotB = new Date(Date.now() + 3 * 3600_000 + 10 * 60_000).toISOString();

    const bookingA = await request(app.getHttpServer())
      .post("/v1/bookings")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ venueId, slotDate: slotA, format: "ONE_ON_ONE" })
      .expect(201);
    bookingAId = bookingA.body.booking.id;
    paymentAId = bookingA.body.payment.id;

    const bookingB = await request(app.getHttpServer())
      .post("/v1/bookings")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ venueId, slotDate: slotB, format: "ONE_ON_ONE" })
      .expect(201);
    bookingBId = bookingB.body.booking.id;
    paymentBId = bookingB.body.payment.id;

    await request(app.getHttpServer())
      .post(`/v1/payments/${paymentAId}/confirm-mock`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/payments/${paymentBId}/confirm-mock`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    // Matching runs on a background worker — poll for it rather than
    // sleeping a fixed amount (see waitUntil's comment above).
    let view!: request.Response;
    await waitUntil(async () => {
      view = await request(app.getHttpServer())
        .get(`/v1/bookings/${bookingAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      return view.body.status === "MATCHED";
    });

    expect(view.body.status).toBe("MATCHED");
    expect(view.body.match.revealed).toBe(false);
  });

  it("never exposes the counterpart's name or id before check-in", async () => {
    const view = await request(app.getHttpServer())
      .get(`/v1/bookings/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(view.body.match.counterpart).toBeDefined();
    expect(view.body.match.counterpart.id).toBeUndefined();
    expect(view.body.match.counterpart.name).toBeUndefined();
    expect(JSON.stringify(view.body.match.counterpart)).not.toMatch(/Rohan/);
    // Only these fields are allowed pre-reveal.
    expect(Object.keys(view.body.match.counterpart).sort()).toEqual(
      ["ageRange", "gender", "relationshipStatus"].sort(),
    );
  });

  it("blocks one member from reading another member's booking (IDOR)", async () => {
    await request(app.getHttpServer())
      .get(`/v1/bookings/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(403);
  });

  it("blocks a plain member from checking anyone in (role gate)", async () => {
    await request(app.getHttpServer())
      .post(`/v1/checkins/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(403);
  });

  it("blocks venue staff who don't work at this venue from checking someone in", async () => {
    // userIdStaff has not been assigned to this venue yet.
    await request(app.getHttpServer())
      .post(`/v1/checkins/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenStaff}`)
      .expect(403);
  });

  it("reveals identities only once BOTH parties have checked in", async () => {
    await db.update(schema.users).set({ role: "VENUE_STAFF" }).where(eq(schema.users.id, userIdStaff));
    await db.insert(schema.venueStaff).values({ venueId, userId: userIdStaff });
    const relogin = await otpLogin(phoneStaff);
    tokenStaff = relogin.accessToken;

    const first = await request(app.getHttpServer())
      .post(`/v1/checkins/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenStaff}`)
      .expect(200);
    expect(first.body.revealed).toBe(false);

    const stillHidden = await request(app.getHttpServer())
      .get(`/v1/bookings/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(stillHidden.body.match.counterpart.name).toBeUndefined();

    const second = await request(app.getHttpServer())
      .post(`/v1/checkins/${bookingBId}`)
      .set("Authorization", `Bearer ${tokenStaff}`)
      .expect(200);
    expect(second.body.revealed).toBe(true);

    const revealed = await request(app.getHttpServer())
      .get(`/v1/bookings/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(revealed.body.match.revealed).toBe(true);
    expect(revealed.body.match.counterpart.name).toBe("Rohan");
    expect(revealed.body.match.counterpart.id).toBe(userIdB);
  });

  it("keeps a 'stay connected' review answer private until both sides say yes, then reveals it as mutual", async () => {
    const reviewA = await request(app.getHttpServer())
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ bookingId: bookingAId, rating: 5, wantsToConnect: true })
      .expect(201);
    expect(reviewA.body.wantsToConnect).toBe(true);

    // Only A has answered so far — no mutual match yet, and B's own answer
    // (not given yet) obviously isn't visible to A.
    const onlyAAnswered = await request(app.getHttpServer())
      .get(`/v1/reviews/connection/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(onlyAAnswered.body).toEqual({
      iHaveReviewed: true,
      iWantToConnect: true,
      counterpartHasReviewed: false,
      mutual: false,
    });

    // B reviews but says no — A can see that B has reviewed, but never what
    // B actually answered (that would defeat the point of asking privately).
    await request(app.getHttpServer())
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ bookingId: bookingBId, rating: 4, wantsToConnect: false })
      .expect(201);

    const bothAnsweredNoMatch = await request(app.getHttpServer())
      .get(`/v1/reviews/connection/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(bothAnsweredNoMatch.body).toEqual({
      iHaveReviewed: true,
      iWantToConnect: true,
      counterpartHasReviewed: true,
      mutual: false,
    });

    // B changes their mind and resubmits — one row per person per booking
    // (upsert), not a second review — and now it's mutual for both sides.
    await request(app.getHttpServer())
      .post("/v1/reviews")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ bookingId: bookingBId, rating: 4, wantsToConnect: true })
      .expect(201);

    const mutualForA = await request(app.getHttpServer())
      .get(`/v1/reviews/connection/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(mutualForA.body.mutual).toBe(true);

    const mutualForB = await request(app.getHttpServer())
      .get(`/v1/reviews/connection/${bookingBId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(mutualForB.body.mutual).toBe(true);

    // Same IDOR boundary as booking reads — B can't check A's own booking.
    await request(app.getHttpServer())
      .get(`/v1/reviews/connection/${bookingAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(403);
  });

  it("lets Trust & Safety/Super Admin review a pending KYC submission and override the outcome", async () => {
    const phoneD = "+919000000008";
    const d = await otpLogin(phoneD);
    await request(app.getHttpServer())
      .post("/v1/kyc/submit")
      .set("Authorization", `Bearer ${d.accessToken}`)
      .send({ documentType: "PASSPORT", videoReference: "mock://d" })
      .expect(201);

    // Checked immediately, before the mock provider's ~3s auto-verify —
    // this is the window a real (async, hours-long) vendor would leave
    // open far longer, which is what this queue exists for.
    const queue = await request(app.getHttpServer())
      .get("/v1/admin/kyc?status=PENDING")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const entry = queue.body.find((k: { userPhone: string }) => k.userPhone === phoneD);
    expect(entry).toBeDefined();

    // A rejection without a reason is refused — the member needs to know
    // what to fix, not just that they were turned down.
    await request(app.getHttpServer())
      .patch(`/v1/admin/kyc/${entry.id}/decide`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ decision: "REJECTED" })
      .expect(400);

    const rejected = await request(app.getHttpServer())
      .patch(`/v1/admin/kyc/${entry.id}/decide`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ decision: "REJECTED", reason: "Document was blurry — please resubmit." })
      .expect(200);
    expect(rejected.body.status).toBe("REJECTED");
    expect(rejected.body.rejectionReason).toBe("Document was blurry — please resubmit.");

    // Neither a plain member nor unassigned venue staff can reach the
    // review queue — it's Trust & Safety/Super Admin only.
    await request(app.getHttpServer())
      .get("/v1/admin/kyc")
      .set("Authorization", `Bearer ${d.accessToken}`)
      .expect(403);
  });

  it("scopes SOS alerts to a venue's own staff, while Trust & Safety/Super Admin see and handle every alert", async () => {
    // A second venue, unrelated to the one tokenStaff is assigned to.
    const venue2Res = await request(app.getHttpServer())
      .post("/v1/venues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Other Cafe", addressLine: "Elsewhere", city: "Hyderabad", tier: "CAFE" })
      .expect(201);
    const venue2Id = venue2Res.body.id;

    // A booking at venue 2, tied to member B — inserted directly since this
    // test is only about SOS authorization, not the booking flow itself.
    const [bookingAtVenue2] = await db
      .insert(schema.bookings)
      .values({
        userId: userIdB,
        venueId: venue2Id,
        slotDate: new Date(Date.now() + 3600_000),
        format: "ONE_ON_ONE",
        pricePaidPaise: 45000,
      })
      .returning();

    const alertRes = await request(app.getHttpServer())
      .post("/v1/sos")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ bookingId: bookingAtVenue2.id })
      .expect(200);
    const alertId = alertRes.body.id;
    expect(alertRes.body.venueId).toBe(venue2Id);

    // tokenStaff is only assigned to the FIRST venue (see the reveal test
    // above) — this alert must not appear in their list, nor be theirs to
    // act on, even though "venue staff" is in their role's allow-list.
    const staffList = await request(app.getHttpServer())
      .get("/v1/sos")
      .set("Authorization", `Bearer ${tokenStaff}`)
      .expect(200);
    expect(staffList.body.map((a: { id: string }) => a.id)).not.toContain(alertId);

    await request(app.getHttpServer())
      .patch(`/v1/sos/${alertId}/acknowledge`)
      .set("Authorization", `Bearer ${tokenStaff}`)
      .expect(403);

    // Super Admin sees and can handle it regardless of venue — the
    // platform-wide safety team is deliberately not scoped.
    const adminList = await request(app.getHttpServer())
      .get("/v1/sos")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(adminList.body.map((a: { id: string }) => a.id)).toContain(alertId);

    await request(app.getHttpServer())
      .patch(`/v1/sos/${alertId}/acknowledge`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
  });

  it("ignores a bookingId an SOS trigger doesn't own, rather than misattributing the alert to a venue/booking that isn't theirs", async () => {
    // member B triggers SOS claiming member A's booking as their own.
    const res = await request(app.getHttpServer())
      .post("/v1/sos")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ bookingId: bookingAId })
      .expect(200);
    expect(res.body.bookingId).toBeNull();
    expect(res.body.venueId).toBeNull();
  });

  it("rejects a Razorpay webhook with an invalid signature", async () => {
    await request(app.getHttpServer())
      .post("/v1/payments/razorpay/webhook")
      .set("x-razorpay-signature", "not-a-real-signature")
      .send({ event: "payment.captured" })
      .expect(403);
  });
});
