import { Injectable, Logger } from "@nestjs/common";
import type { SmsProvider } from "./sms-provider.interface";

/**
 * Safe default for local development and CI: instead of sending a real SMS,
 * it logs the OTP so a developer (or an automated test) can read it. Never
 * wired up in production — see IntegrationsModule.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger("MockSms");

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`[MOCK SMS] OTP for ${phone}: ${code}`);
  }
}
