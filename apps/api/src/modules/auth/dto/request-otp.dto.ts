import { Matches } from "class-validator";

export class RequestOtpDto {
  // Indian mobile numbers in E.164 form, e.g. +919876543210. Deliberately
  // narrow for the MVP (Hyderabad launch) rather than accepting any string.
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: "Enter a valid Indian mobile number, e.g. +919876543210.",
  })
  phone!: string;
}
