import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

// Real-world limit for how often one IP may ask for an OTP: tight, because
// this is the endpoint that actually costs money (an SMS) and is the
// classic target for abuse. Relaxed in automated tests only, where many
// legitimate test users share the same loopback IP in a single run — the
// DB-backed per-phone-number limit in AuthService (5/hour) is what actually
// protects a real phone number regardless of this value.
const OTP_REQUEST_LIMIT = process.env.NODE_ENV === "test" ? 1000 : 3;
const OTP_VERIFY_LIMIT = process.env.NODE_ENV === "test" ? 1000 : 10;

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  // Belt-and-suspenders on top of the DB-backed hourly limit in AuthService:
  // this stops rapid-fire requests within a short window even before they
  // hit the database.
  @Throttle({ default: { limit: OTP_REQUEST_LIMIT, ttl: 60_000 } })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: OTP_VERIFY_LIMIT, ttl: 60_000 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
