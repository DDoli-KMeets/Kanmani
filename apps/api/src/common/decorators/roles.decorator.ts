import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@kmeets/shared";

export const ROLES_KEY = "roles";

/**
 * Marks a controller/route as requiring one of the given roles. Combined
 * with RolesGuard, this is the server-side authorization check — the thing
 * that actually matters, since a hidden button in the app is not security.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
