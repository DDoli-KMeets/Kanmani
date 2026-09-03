import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { bullConnectionOptions } from "../../redis/redis.module";
import { MATCHING_QUEUE_NAME } from "./matching-queue.provider";
import { MatchingService } from "./matching.service";

/**
 * Starts a BullMQ worker that actually processes "try-match" jobs. Kept as
 * its own provider (rather than inline in MatchingService) so it's obvious
 * this is the piece doing background work, and so tests can use
 * MatchingService.tryMatch() directly without spinning up a worker.
 */
@Injectable()
export class MatchingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchingWorker.name);
  private worker?: Worker;

  constructor(private readonly matching: MatchingService) {}

  onModuleInit() {
    this.worker = new Worker(
      MATCHING_QUEUE_NAME,
      async (job) => {
        if (job.name === "try-match") {
          await this.matching.tryMatch(job.data.bookingId);
        }
      },
      { ...bullConnectionOptions(), concurrency: 5 },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Matching job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
