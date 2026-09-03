import { Global, Module } from "@nestjs/common";
import { SMS_PROVIDER } from "./sms/sms-provider.interface";
import { MockSmsProvider } from "./sms/mock-sms.provider";
import { Msg91SmsProvider } from "./sms/msg91-sms.provider";
import { KYC_PROVIDER } from "./kyc/kyc-provider.interface";
import { MockKycProvider } from "./kyc/mock-kyc.provider";
import { DigioKycProvider } from "./kyc/digio-kyc.provider";
import { PAYMENT_PROVIDER } from "./payments/payment-provider.interface";
import { MockPaymentProvider } from "./payments/mock-payment.provider";
import { RazorpayPaymentProvider } from "./payments/razorpay-payment.provider";
import { PUSH_PROVIDER } from "./push/push-provider.interface";
import { MockPushProvider } from "./push/mock-push.provider";
import { FirebasePushProvider } from "./push/firebase-push.provider";

/**
 * Every third-party integration (SMS, KYC, payments, push) is selected here,
 * once, based on environment variables — see apps/api/.env.example. The
 * rest of the app depends only on the interfaces in this folder, never on a
 * vendor SDK directly, so swapping a provider later (or running fully
 * mocked, as we do now with no vendor accounts yet) never touches business
 * logic elsewhere.
 */
@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useClass: process.env.SMS_PROVIDER === "msg91" ? Msg91SmsProvider : MockSmsProvider,
    },
    {
      provide: KYC_PROVIDER,
      useClass: process.env.KYC_PROVIDER === "digio" ? DigioKycProvider : MockKycProvider,
    },
    {
      provide: PAYMENT_PROVIDER,
      useClass:
        process.env.PAYMENT_PROVIDER === "razorpay" ? RazorpayPaymentProvider : MockPaymentProvider,
    },
    {
      provide: PUSH_PROVIDER,
      useClass: process.env.PUSH_PROVIDER === "firebase" ? FirebasePushProvider : MockPushProvider,
    },
  ],
  exports: [SMS_PROVIDER, KYC_PROVIDER, PAYMENT_PROVIDER, PUSH_PROVIDER],
})
export class IntegrationsModule {}
