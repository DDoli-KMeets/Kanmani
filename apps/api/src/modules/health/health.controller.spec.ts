import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";

/**
 * A hosting platform decides whether to route traffic to this process (or
 * restart it) based on this endpoint alone, so it has to actually mean
 * something — confirming the process can reach its database and Redis, not
 * just that Node is running. Mocked db/redis so this runs without a real
 * database, unlike the full e2e suite.
 */
describe("HealthController", () => {
  function buildController(dbOk: boolean, redisOk: boolean) {
    const db = {
      execute: jest.fn().mockImplementation(() => (dbOk ? Promise.resolve() : Promise.reject(new Error("down")))),
    };
    const redis = {
      ping: jest.fn().mockImplementation(() => (redisOk ? Promise.resolve("PONG") : Promise.reject(new Error("down")))),
    };
    return new HealthController(db as any, redis as any);
  }

  it("reports ok when both the database and Redis respond", async () => {
    const controller = buildController(true, true);
    await expect(controller.check()).resolves.toEqual({ status: "ok", database: "ok", redis: "ok" });
  });

  it("fails when the database is unreachable, even if Redis is fine", async () => {
    const controller = buildController(false, true);
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("fails when Redis is unreachable, even if the database is fine", async () => {
    const controller = buildController(true, false);
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
