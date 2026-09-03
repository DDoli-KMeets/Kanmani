import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getKycStatus, submitKyc } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import type { KycStatusValue } from "../api/types";

/**
 * Video KYC submission. In production this step hands off to a vendor SDK
 * (Digio/Signzy) that records a short liveness-check video and uploads it
 * directly to the vendor — K-Meets' own server never sees raw video bytes,
 * only a reference ID (see SubmitKycDto's comment). No vendor account
 * exists yet (see docs/DEPLOYMENT.md), so this screen collects the document
 * type and calls the same submit endpoint with a placeholder reference —
 * the real SDK hand-off is a drop-in swap for the button below once a
 * vendor is wired up, behind KYC_PROVIDER.
 */
export function Kyc() {
  const [status, setStatus] = useState<KycStatusValue | "LOADING">("LOADING");
  const [documentType, setDocumentType] = useState<"PAN" | "PASSPORT">("PAN");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const pollRef = useRef<number | null>(null);

  async function loadStatus() {
    try {
      const res = await getKycStatus();
      setStatus(res.status);
      return res.status;
    } catch {
      setStatus("NOT_STARTED");
      return "NOT_STARTED";
    }
  }

  useEffect(() => {
    loadStatus();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
     
  }, []);

  useEffect(() => {
    if (status === "PENDING" && !pollRef.current) {
      pollRef.current = window.setInterval(async () => {
        const latest = await loadStatus();
        if (latest !== "PENDING" && pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 2000);
    }
     
  }, [status]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const reference = `mock://web/${crypto.randomUUID()}`;
      const res = await submitKyc(documentType, reference);
      setStatus(res.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit KYC. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "LOADING") {
    return (
      <div className="center-screen">
        <Spinner dark />
      </div>
    );
  }

  return (
    <div className="screen no-nav">
      <div style={{ paddingTop: 12 }}>
        <h2>Verify it's really you</h2>
        <p>
          Every K-Meets member completes a quick identity check before booking their first meetup — it's what keeps
          the community accountable and safe.
        </p>
      </div>

      {status === "VERIFIED" && (
        <div className="stack">
          <div className="card">
            <span className="badge badge-good">Verified</span>
            <p style={{ marginTop: 10, marginBottom: 0 }}>You're all set — you can book a meetup any time.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/venues")}>
            Browse venues
          </button>
        </div>
      )}

      {status === "PENDING" && (
        <div className="card stack" style={{ alignItems: "center", textAlign: "center" }}>
          <Spinner dark />
          <span className="badge badge-warn">Reviewing</span>
          <p style={{ marginBottom: 0 }}>This usually takes a few moments. We'll update this page automatically.</p>
        </div>
      )}

      {status === "REJECTED" && (
        <div className="stack">
          <div className="error-banner">Your last submission couldn't be verified. Please try again.</div>
        </div>
      )}

      {(status === "NOT_STARTED" || status === "REJECTED") && (
        <div className="stack">
          <div className="field">
            <label>Document type</label>
            <div className="chip-grid">
              <button
                type="button"
                className={`chip ${documentType === "PAN" ? "selected" : ""}`}
                onClick={() => setDocumentType("PAN")}
              >
                PAN card
              </button>
              <button
                type="button"
                className={`chip ${documentType === "PASSPORT" ? "selected" : ""}`}
                onClick={() => setDocumentType("PASSPORT")}
              >
                Passport
              </button>
            </div>
          </div>
          <div className="info-banner">
            We never store your government ID number — only a verified/not-verified result from our identity
            partner.
          </div>
          {error && <div className="error-banner">{error}</div>}
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Spinner /> : "Start video verification"}
          </button>
          <button className="btn btn-outline" onClick={() => navigate("/venues")}>
            I'll do this later
          </button>
        </div>
      )}
    </div>
  );
}
