import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export function TopNav() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;

  const isAdmin = profile.role === "SUPER_ADMIN";
  const isTrustSafety = profile.role === "TRUST_AND_SAFETY" || isAdmin;
  const isVenueStaff = profile.role === "VENUE_STAFF" || isAdmin;

  return (
    <header className="top-bar">
      <span className="brand">K-Meets Staff</span>
      <nav>
        {isVenueStaff && (
          <NavLink to="/roster" className={({ isActive }) => (isActive ? "active" : "")}>
            Check-in
          </NavLink>
        )}
        <NavLink to="/sos" className={({ isActive }) => (isActive ? "active" : "")}>
          SOS
        </NavLink>
        {isTrustSafety && (
          <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>
            Reports
          </NavLink>
        )}
        {isTrustSafety && (
          <NavLink to="/kyc" className={({ isActive }) => (isActive ? "active" : "")}>
            KYC
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/venues" className={({ isActive }) => (isActive ? "active" : "")}>
            Venues
          </NavLink>
        )}
        {isTrustSafety && (
          <NavLink to="/metrics" className={({ isActive }) => (isActive ? "active" : "")}>
            Metrics
          </NavLink>
        )}
      </nav>
      <div className="who">
        <span>
          {profile.name ?? profile.phone} · {profile.role.replace(/_/g, " ").toLowerCase()}
        </span>
        <button
          onClick={() => {
            signOut();
            navigate("/login", { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
