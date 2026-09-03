import { IsIn, IsString, MinLength } from "class-validator";

export class SubmitKycDto {
  @IsIn(["PAN", "PASSPORT"])
  documentType!: "PAN" | "PASSPORT";

  // In production this is a reference to the uploaded KYC video in private
  // object storage (see StorageService), never the raw video bytes over
  // this JSON API and never a government ID number.
  @IsString()
  @MinLength(1)
  videoReference!: string;
}
