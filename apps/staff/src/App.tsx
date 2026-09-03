import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequireRole } from "./components/RequireRole";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Roster } from "./pages/Roster";
import { Sos } from "./pages/Sos";
import { Reports } from "./pages/Reports";
import { Venues } from "./pages/Venues";
import { Metrics } from "./pages/Metrics";
import { Kyc } from "./pages/Kyc";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <div className="app-shell">
            <Login />
          </div>
        }
      />

      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/sos" element={<Sos />} />

        <Route element={<RequireRole allow={["VENUE_STAFF", "SUPER_ADMIN"]} />}>
          <Route path="/roster" element={<Roster />} />
        </Route>

        <Route element={<RequireRole allow={["TRUST_AND_SAFETY", "SUPER_ADMIN"]} />}>
          <Route path="/reports" element={<Reports />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/kyc" element={<Kyc />} />
        </Route>

        <Route element={<RequireRole allow={["SUPER_ADMIN"]} />}>
          <Route path="/venues" element={<Venues />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
