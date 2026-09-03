import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";

@Controller({ path: "reviews", version: "1" })
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return this.reviews.createForBooking(user.userId, dto);
  }

  @Get("mine/received")
  myReceived(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.myReceivedReviews(user.userId);
  }

  @Get("connection/:bookingId")
  connectionStatus(@CurrentUser() user: AuthenticatedUser, @Param("bookingId") bookingId: string) {
    return this.reviews.getConnectionStatus(user.userId, bookingId);
  }
}
