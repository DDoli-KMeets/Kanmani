import { useEffect, useState } from "react";
import { decideKyc, listKycQueue } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { formatDateTime } from "../utils/format";
import type { KycSubmission } from "../api/types";

const STATUS_TABS: { value: KycSubmission["status"] | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" },
  { value: "VERIFIED", label: "Verified" },
  { value: "ALL", label: "All" },
];

export function Kyc() {
  const [tab, setTab] = useState<KycSubmission["status"] | "ALL">("PENDING");
  const [rows, setRows] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listKycQueue(tab === "ALL" ? undefined : tab)
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the KYC queue."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tab]);

  async function handleApprove(id: string) {
    setSubmitting(id);
    setError(null);
    try {
      await decideKyc(id, "VERIFIED");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't approve this submission.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleReject(id: string) {
    const reason = reasonDraft[id]?.trim();
    if (!reason) {
      setError("Write a reason before rejecting — the member sees this so they can fix and resubmit.");
      return;
    }
    setSubmitting(id);
    setError(null);
    try {
      await decideKyc(id, "REJECTED", reason);
      setDecidingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reject this submission.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h2>KYC review</h2>
        <p>
          Identity verifications the provider hasn't already cleared — mostly relevant once a real KYC vendor is
          connected; today's mock provider auto-verifies almost everything, so a healthy queue here is usually
          empty.
        </p>
      </div>

      <div className="tabs">
        {STATUS_TABS.map((t) => (
          <button key={t.value} className={`chip ${tab === t.value ? "selected" : ""}`} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="empty-state">
          <Spinner dark />
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="glyph">✓</div>
          <p>Nothing here.</p>
        </div>
      ) : (
        <div>
          {rows.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row-between">
                <div>
                  <strong>{r.userName ?? r.userPhone}</strong>
                  <span className="muted"> {r.userPhone}</span>
                </div>
                <span
                  className={`badge ${
                    r.status === "REJECTED" ? "badge-bad" : r.status === "PENDING" ? "badge-warn" : "badge-good"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p style={{ marginTop: 8 }}>
                <span className="muted">Document: </span>
                {r.documentType ?? "—"}
                <span className="muted"> · Provider: </span>
                {r.provider}
              </p>
              <span className="muted">
                {r.submittedAt ? `Submitted ${formatDateTime(r.submittedAt)}` : "Not yet submitted"}
              </span>

              {r.status === "REJECTED" && r.rejectionReason && (
                <div className="info-banner" style={{ marginTop: 10 }}>
                  Rejection reason: {r.rejectionReason}
                </div>
              )}

              {r.status === "PENDING" && (
                <div style={{ marginTop: 12 }}>
                  {decidingId === r.id ? (
                    <div className="stack">
                      <div className="field">
                        <label>Rejection reason</label>
                        <textarea
                          value={reasonDraft[r.id] ?? ""}
                          onChange={(e) => setReasonDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="What was wrong with the submission?"
                        />
                      </div>
                      <div className="row-between">
                        <button className="btn btn-primary" onClick={() => handleReject(r.id)} disabled={submitting === r.id}>
                          {submitting === r.id ? <Spinner /> : "Confirm rejection"}
                        </button>
                        <button className="btn btn-outline" onClick={() => setDecidingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="row-between">
                      <button className="btn btn-secondary" onClick={() => handleApprove(r.id)} disabled={submitting === r.id}>
                        {submitting === r.id ? <Spinner /> : "Approve"}
                      </button>
                      <button className="btn btn-outline" onClick={() => setDecidingId(r.id)}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
