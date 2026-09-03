import { Global, Module, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

export const REDIS = "REDIS";

let sharedClient: Redis | undefined;

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () => {
        const url = process.env.REDIS_URL ?? "redis://localhost:6379";
        sharedClient = new Redis(url, { maxRetriesPerRequest: null });
        return sharedClient;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  async onModuleDestroy() {
    // Closes the connection cleanly on app shutdown / test teardown so
    // nothing keeps the Node process (or a Jest run) alive afterwards.
    await sharedClient?.quit();
    sharedClient = undefined;
  }
}

/** Connection options in the shape BullMQ expects, sharing the same Redis host. */
export function bullConnectionOptions() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    connection: {
      host: url.hostname,
      port: Number(url.port || 6379),
    },
  };
}
