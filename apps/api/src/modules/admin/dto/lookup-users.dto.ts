import { ArrayMaxSize, IsArray, IsUUID } from "class-validator";

export class LookupUsersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  userIds!: string[];
}
