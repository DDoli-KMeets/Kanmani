import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { TopNav } from "./TopNav";
import { Spinner } from "./Spinner";

/** Uses <Navigate> (a declarative redirect) rather than calling navigate()
 * during render — see the same fix's comment in apps/web for why that
 * matters: an imperative navigate() call during render logs a React
 * warning and isn't reliably committed before the next paint. */
export function AppLayout() {
  const { loading, isAuthenticated, isAuthorizedStaff } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner dark />
      </div>
    );
  }

  if (!isAuthenticated || !isAuthorizedStaff) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <TopNav />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
