import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import type { StaffRole } from "../api/types";

/** Backend guards (@Roles) are the real authorization boundary — this is
 * just so a staff member who types in a URL they don't have a tab for
 * sees a clean redirect instead of a page full of 403 errors. */
export function RequireRole({ allow }: { allow: StaffRole[] }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!allow.includes(profile.role as StaffRole)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
