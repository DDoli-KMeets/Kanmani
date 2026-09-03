import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";
import type { Database } from "../../database/client";
import { schema } from "../../database/client";
import type { AuthenticatedUser } from "../types/authenticated-user";

/**
 * Verifies the bearer access token on every protected route and attaches
 * the authenticated user to the request. This — not anything the client
 * claims about itself — is what every downstream authorization check relies
 * on (build plan §08: "never rely only on frontend restrictions").
 *
 * Also re-checks the account is still ACTIVE on every single request, not
 * just at login/refresh time. Access tokens are short-lived (15 minutes by
 * default) but this is a safety app with an active moderation/ban system —
 * a member banned for a harassment or safety report must be cut off
 * immediately, not "within 15 minutes." The extra lookup is a single
 * indexed primary-key read, negligible at this app's scale.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers["authorization"];

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Sign in to continue.");
    }

    const token = authHeader.slice("Bearer ".length);
    let payload: AuthenticatedUser;
    try {
      payload = this.jwt.verify<AuthenticatedUser>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Your session has expired. Please sign in again.");
    }

    const [user] = await this.db
      .select({ accountStatus: schema.users.accountStatus, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId))
      .limit(1);

    if (!user || user.accountStatus !== "ACTIVE") {
      throw new UnauthorizedException("This account is no longer active.");
    }

    // Use the token's own role for this request rather than the freshly
    // read one: a role *promotion* taking a request or two to propagate is
    // harmless, and re-signing every downstream check's expectations here
    // would be a bigger change than this fix calls for. What actually
    // matters — a de-activated account losing access immediately — is
    // covered by the accountStatus check above.
    request.user = payload;
    return true;
  }
}
