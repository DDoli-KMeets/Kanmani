import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { useAuth } from "./state/AuthContext";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Kyc } from "./pages/Kyc";
import { Venues } from "./pages/Venues";
import { VenueDetail } from "./pages/VenueDetail";
import { Payment } from "./pages/Payment";
import { MyMeetups } from "./pages/MyMeetups";
import { MeetupDetail } from "./pages/MeetupDetail";
import { ReviewForm } from "./pages/ReviewForm";
import { ReportForm } from "./pages/ReportForm";
import { Community } from "./pages/Community";
import { Profile } from "./pages/Profile";

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          !loading && isAuthenticated ? (
            <Navigate to="/venues" replace />
          ) : (
            <div className="app-shell">
              <Login />
            </div>
          )
        }
      />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/kyc" element={<Kyc />} />
        <Route path="/pay/:paymentId" element={<Payment />} />
      </Route>

      <Route element={<AppLayout />}>
        <Route path="/venues" element={<Venues />} />
        <Route path="/venues/:venueId" element={<VenueDetail />} />
        <Route path="/meetups" element={<MyMeetups />} />
        <Route path="/meetups/:bookingId" element={<MeetupDetail />} />
        <Route path="/meetups/:bookingId/review" element={<ReviewForm />} />
        <Route path="/meetups/:bookingId/report" element={<ReportForm />} />
        <Route path="/community" element={<Community />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/venues" replace />} />
    </Routes>
  );
}
