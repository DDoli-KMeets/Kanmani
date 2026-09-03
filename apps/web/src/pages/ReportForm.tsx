import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fileReport, getBooking } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TopBar } from "../components/TopBar";
import type { CounterpartRevealed, ReportReason } from "../api/types";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "inappropriate_behavior", label: "Inappropriate behavior" },
  { value: "safety_concern", label: "Safety concern" },
  { value: "no_show", label: "They didn't show up" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Something else" },
];

export function ReportForm() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [reportedUserId, setReportedUserId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportReason>("inappropriate_behavior");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!bookingId) return;
    getBooking(bookingId)
      .then((b) => {
        if (b.match?.revealed) {
          setReportedUserId((b.match.counterpart as CounterpartRevealed).id);
        }
      })
      .catch(() => setError("Couldn't load this meetup."))
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function handleSubmit() {
    if (!reportedUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await fileReport(reportedUserId, reason, bookingId, details.trim() || undefined);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner dark />
      </div>
    );
  }

  if (submitted) {
    return (
      <>
        <TopBar title="Report submitted" back />
        <div className="screen no-nav">
          <div className="stack">
            <div className="info-banner">
              Our Trust & Safety team will review this. Thank you for flagging it — it helps keep K-Meets safe for
              everyone.
            </div>
            <button className="btn btn-primary" onClick={() => navigate(`/meetups/${bookingId}`)}>
              Done
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Report a concern" back />
      <div className="screen no-nav">
        {!reportedUserId ? (
          <div className="error-banner">
            {error ?? "This meetup hasn't been revealed yet, so there's no one to report. If you're in immediate danger, use the SOS button instead."}
          </div>
        ) : (
          <div className="stack">
            <div className="field">
              <label>What happened?</label>
              <div className="chip-grid">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    className={`chip ${reason === r.value ? "selected" : ""}`}
                    onClick={() => setReason(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="details">Details (optional)</label>
              <textarea
                id="details"
                value={details}
                maxLength={2000}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything else our Trust & Safety team should know."
              />
            </div>

            {error && <div className="error-banner">{error}</div>}

            <button className="btn btn-danger" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Spinner /> : "Submit report"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
