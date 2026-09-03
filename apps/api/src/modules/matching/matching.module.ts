import { Module } from "@nestjs/common";
import { MatchingQueueHandle, matchingQueueProvider } from "./matching-queue.provider";
import { MatchingService } from "./matching.service";
import { MatchingWorker } from "./matching.worker";

@Module({
  providers: [MatchingQueueHandle, matchingQueueProvider, MatchingService, MatchingWorker],
  exports: [MatchingService],
})
export class MatchingModule {}
