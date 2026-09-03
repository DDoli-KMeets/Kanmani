import { Navigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

/** Sends each role to the screen it'll use most: venue staff go straight
 * to check-in, Trust & Safety to the moderation queue, admins to the
 * overview. Everyone can still reach every tab they're allowed via the
 * top nav. */
export function Home() {
  const { profile } = useAuth();
  if (!profile) return null;

  if (profile.role === "VENUE_STAFF") return <Navigate to="/roster" replace />;
  if (profile.role === "TRUST_AND_SAFETY") return <Navigate to="/reports" replace />;
  return <Navigate to="/metrics" replace />;
}
