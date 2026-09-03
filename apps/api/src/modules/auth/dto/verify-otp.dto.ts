import { Matches } from "class-validator";

export class VerifyOtpDto {
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: "Enter a valid Indian mobile number, e.g. +919876543210.",
  })
  phone!: string;

  @Matches(/^\d{6}$/, { message: "Enter the 6-digit code we sent you." })
  code!: string;
}
