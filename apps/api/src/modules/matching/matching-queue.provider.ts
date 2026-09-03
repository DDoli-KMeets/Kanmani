import { Injectable, OnModuleDestroy, Provider } from "@nestjs/common";
import { Queue } from "bullmq";
import { bullConnectionOptions } from "../../redis/redis.module";

export const MATCHING_QUEUE = "MATCHING_QUEUE";
export const MATCHING_QUEUE_NAME = "matching";

/**
 * Thin wrapper around a BullMQ Queue so Nest can close its Redis connection
 * on shutdown (OnModuleDestroy) — without this, the connection stays open
 * and keeps the process (or a test run) alive after everything else has
 * finished.
 */
@Injectable()
export class MatchingQueueHandle implements OnModuleDestroy {
  readonly queue = new Queue(MATCHING_QUEUE_NAME, {
    ...bullConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  async onModuleDestroy() {
    await this.queue.close();
  }
}

export const matchingQueueProvider: Provider = {
  provide: MATCHING_QUEUE,
  useFactory: (handle: MatchingQueueHandle) => handle.queue,
  inject: [MatchingQueueHandle],
};
