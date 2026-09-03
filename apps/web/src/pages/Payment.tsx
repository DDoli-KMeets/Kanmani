import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { confirmMockPayment } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TopBar } from "../components/TopBar";

/**
 * Stands in for the real Razorpay checkout screen. Because PAYMENT_PROVIDER
 * is "mock" (no merchant account exists yet — see docs/DEPLOYMENT.md), this
 * button calls the same confirm-mock endpoint the backend's automated
 * tests use, which is only reachable while PAYMENT_PROVIDER=mock. Once a
 * real Razorpay account exists, this screen is replaced with Razorpay's own
 * checkout widget — nothing else about the booking flow changes.
 */
export function Payment() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const location = useLocation();
  const bookingId = (location.state as { bookingId?: string } | null)?.bookingId;
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleConfirm() {
    if (!paymentId) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmMockPayment(paymentId);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Payment couldn't be confirmed. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (done) {
    return (
      <div className="center-screen">
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          <div className="glyph" style={{ fontSize: "2.6rem" }}>
            ✓
          </div>
          <h2>You're booked</h2>
          <p>
            We're looking for someone who shares your interests around the same time. You'll see them appear under
            Meetups once matched.
          </p>
          <button className="btn btn-primary" onClick={() => navigate(bookingId ? `/meetups/${bookingId}` : "/meetups")}>
            View my meetup
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <TopBar title="Payment" />
      <div className="screen no-nav">
        <div className="stack">
          <div className="card stack" style={{ alignItems: "center", textAlign: "center", padding: 28 }}>
            <span className="muted">Test payment — no real money moves</span>
            <p style={{ marginBottom: 0 }}>
              This stands in for the checkout screen you'll see once card and UPI payments are live.
            </p>
          </div>
          {error && <div className="error-banner">{error}</div>}
          <button className="btn btn-primary" onClick={handleConfirm} disabled={confirming}>
            {confirming ? <Spinner /> : "Simulate successful payment"}
          </button>
        </div>
      </div>
    </>
  );
}
