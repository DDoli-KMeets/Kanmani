import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../types/authenticated-user";

/**
 * Pulls the authenticated user (attached by JwtAuthGuard) out of the
 * request. Using this instead of trusting any user id the client sends in
 * the request body is what prevents one member acting as another.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
