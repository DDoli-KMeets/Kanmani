import { Injectable, Logger } from "@nestjs/common";
import type { PushMessage, PushProvider } from "./push-provider.interface";

@Injectable()
export class MockPushProvider implements PushProvider {
  private readonly logger = new Logger("MockPush");

  async send(message: PushMessage): Promise<void> {
    this.logger.log(`[MOCK PUSH] → user ${message.userId}: ${message.title} — ${message.body}`);
  }
}
