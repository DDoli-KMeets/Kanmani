import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useActiveBookingContext } from "../state/ActiveBookingContext";
import { BottomNav } from "./BottomNav";
import { SosButton } from "./SosButton";
import { Spinner } from "./Spinner";

/** Wraps every screen that requires a signed-in member: redirects to login
 * if not authenticated, sends incomplete profiles to onboarding first, and
 * renders the bottom tab bar + always-available SOS button around the
 * active screen. Uses <Navigate> (a declarative redirect) rather than
 * calling navigate() during render, which React logs a warning for and
 * which router doesn't reliably commit before the next paint. */
export function AppLayout() {
  const { loading, isAuthenticated, profile } = useAuth();
  const { activeBookingId } = useActiveBookingContext();

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner dark />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (profile && !profile.name) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="app-shell">
      <Outlet />
      <SosButton activeBookingId={activeBookingId} />
      <BottomNav />
    </div>
  );
}
