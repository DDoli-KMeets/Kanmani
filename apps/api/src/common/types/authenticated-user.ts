import type { UserRole } from "@kmeets/shared";

export interface AuthenticatedUser {
  userId: string;
  phone: string;
  role: UserRole;
}
