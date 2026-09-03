import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Spinner } from "./Spinner";

/** Like AppLayout's auth check, but for the handful of full-screen flows
 * (onboarding, KYC, payment) that don't show the bottom tab bar or SOS
 * button. */
export function RequireAuth() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="app-shell">
        <div className="center-screen">
          <Spinner dark />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Outlet />
    </div>
  );
}
