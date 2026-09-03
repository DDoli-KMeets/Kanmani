export const SMS_PROVIDER = "SMS_PROVIDER";

/**
 * Every SMS provider (mock, MSG91, or anything else later) implements this.
 * Nothing outside this folder ever imports a vendor SDK directly — that's
 * what lets us switch providers, or run entirely without a real account
 * during development, by changing one environment variable.
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}
