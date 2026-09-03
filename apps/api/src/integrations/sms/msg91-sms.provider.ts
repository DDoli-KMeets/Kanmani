import { Injectable, Logger } from "@nestjs/common";
import type { SmsProvider } from "./sms-provider.interface";

/**
 * Real MSG91 integration. NOT wired up until MSG91_AUTH_KEY is provided —
 * see docs/ENVIRONMENT.md for where to get one and exactly what to paste in.
 * Left as a documented stub rather than fully implemented against a live
 * account, since no MSG91 account exists yet (per the founder's answer that
 * no business/vendor accounts are set up yet).
 */
@Injectable()
export class Msg91SmsProvider implements SmsProvider {
  private readonly logger = new Logger("Msg91Sms");

  // _code: part of the SmsProvider interface; this stub throws before using
  // it, and a real implementation (see comment below) will need it.
  async sendOtp(phone: string, _code: string): Promise<void> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      throw new Error(
        "SMS_PROVIDER=msg91 but MSG91_AUTH_KEY is not set. See docs/ENVIRONMENT.md.",
      );
    }

    // Intentionally not implemented against a live account yet — flip
    // SMS_PROVIDER back to "mock" until MSG91 credentials exist, then
    // replace this body with a real call to MSG91's OTP API
    // (https://docs.msg91.com/reference/send-otp) and remove this log line.
    this.logger.warn(
      `[MSG91 STUB] Would send OTP to ${phone}. Wire up the real API call once MSG91_AUTH_KEY is a live credential.`,
    );
    throw new Error(
      "Msg91SmsProvider is a documented stub — implement the real API call before using it in production.",
    );
  }
}
