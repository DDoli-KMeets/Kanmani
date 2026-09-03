import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PaymentsService } from "./payments.service";

@Controller({ path: "payments", version: "1" })
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(":id/confirm-mock")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  confirmMock(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.payments.confirmMockPayment(user.userId, id);
  }

  // Razorpay webhooks are server-to-server and signed — not user-authenticated.
  // Raw body access is configured in main.ts / app.module for this exact route.
  @Post("razorpay/webhook")
  @HttpCode(HttpStatus.OK)
  async razorpayWebhook(@Req() req: Request, @Headers("x-razorpay-signature") signature: string) {
    await this.payments.handleRazorpayWebhook((req as any).rawBody, signature ?? "");
    return { received: true };
  }
}
