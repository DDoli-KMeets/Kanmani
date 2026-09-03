import { useEffect, useState } from "react";
import { listReports, lookupUsers, resolveReport } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { formatDateTime } from "../utils/format";
import type { Report, UserSummary } from "../api/types";

const REASON_LABEL: Record<Report["reason"], string> = {
  inappropriate_behavior: "Inappropriate behavior",
  safety_concern: "Safety concern",
  no_show: "No-show",
  fake_profile: "Fake profile",
  harassment: "Harassment",
  other: "Other",
};

const STATUS_TABS: { value: Report["status"] | "ALL"; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "INVESTIGATING", label: "Investigating" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ALL", label: "All" },
];

const STRIKE_OPTIONS: { value: "" | "WARNING" | "SUSPENSION" | "BAN"; label: string }[] = [
  { value: "", label: "No strike" },
  { value: "WARNING", label: "Warning" },
  { value: "SUSPENSION", label: "7-day suspension" },
  { value: "BAN", label: "Permanent ban" },
];

export function Reports() {
  const [tab, setTab] = useState<Report["status"] | "ALL">("OPEN");
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<Record<string, UserSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState<Record<string, string>>({});
  const [strikeDraft, setStrikeDraft] = useState<Record<string, "" | "WARNING" | "SUSPENSION" | "BAN">>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listReports(tab === "ALL" ? undefined : tab)
      .then(async (rows) => {
        setReports(rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
        const ids = Array.from(new Set(rows.flatMap((r) => [r.reporterId, r.reportedId])));
        const summaries = await lookupUsers(ids).catch(() => []);
        setUsers(Object.fromEntries(summaries.map((u) => [u.id, u])));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load reports."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tab]);

  async function handleResolve(id: string) {
    const resolution = resolutionDraft[id]?.trim();
    if (!resolution) {
      setError("Write a resolution note before resolving this report.");
      return;
    }
    setSubmitting(id);
    setError(null);
    try {
      await resolveReport(id, resolution, strikeDraft[id] || undefined);
      setResolvingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't resolve this report.");
    } finally {
      setSubmitting(null);
    }
  }

  function userLabel(id: string): string {
    const u = users[id];
    return u ? u.name ?? u.phone : id.slice(0, 8);
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Moderation queue</h2>
        <p>Reports members have filed, most recent first.</p>
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
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <div className="glyph">✓</div>
          <p>Nothing here.</p>
        </div>
      ) : (
        <div>
          {reports.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row-between">
                <div>
                  <strong>{userLabel(r.reportedId)}</strong>
                  <span className="muted"> reported by {userLabel(r.reporterId)}</span>
                </div>
                <span
                  className={`badge ${r.status === "OPEN" ? "badge-bad" : r.status === "INVESTIGATING" ? "badge-warn" : "badge-good"}`}
                >
                  {r.status}
                </span>
              </div>
              <p style={{ marginTop: 8 }}>
                <strong>{REASON_LABEL[r.reason]}</strong>
                {r.details ? ` — ${r.details}` : ""}
              </p>
              <span className="muted">{formatDateTime(r.createdAt)}</span>

              {r.status === "RESOLVED" && r.resolution && (
                <div className="info-banner" style={{ marginTop: 10 }}>
                  Resolution: {r.resolution}
                </div>
              )}

              {r.status !== "RESOLVED" && (
                <div style={{ marginTop: 12 }}>
                  {resolvingId === r.id ? (
                    <div className="stack">
                      <div className="field">
                        <label>Resolution note</label>
                        <textarea
                          value={resolutionDraft[r.id] ?? ""}
                          onChange={(e) => setResolutionDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="What did you find, and what action was taken?"
                        />
                      </div>
                      <div className="field">
                        <label>Strike (optional)</label>
                        <select
                          value={strikeDraft[r.id] ?? ""}
                          onChange={(e) =>
                            setStrikeDraft((prev) => ({
                              ...prev,
                              [r.id]: e.target.value as "" | "WARNING" | "SUSPENSION" | "BAN",
                            }))
                          }
                        >
                          {STRIKE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="row-between">
                        <button className="btn btn-primary" onClick={() => handleResolve(r.id)} disabled={submitting === r.id}>
                          {submitting === r.id ? <Spinner /> : "Submit resolution"}
                        </button>
                        <button className="btn btn-outline" onClick={() => setResolvingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => setResolvingId(r.id)}>
                      Resolve
                    </button>
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
