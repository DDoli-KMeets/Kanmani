import { useEffect, useState } from "react";
import { acknowledgeSos, listSosAlerts, lookupUsers, resolveSos } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { formatDateTime } from "../utils/format";
import type { SosAlert, UserSummary } from "../api/types";

const STATUS_BADGE: Record<SosAlert["status"], { label: string; cls: string }> = {
  TRIGGERED: { label: "Active — needs response", cls: "badge-bad" },
  ACKNOWLEDGED: { label: "Being handled", cls: "badge-warn" },
  RESOLVED: { label: "Resolved", cls: "badge-good" },
};

export function Sos() {
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [users, setUsers] = useState<Record<string, UserSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  function load() {
    listSosAlerts()
      .then(async (rows) => {
        const sorted = rows.sort((a, b) => +new Date(b.triggeredAt) - +new Date(a.triggeredAt));
        setAlerts(sorted);
        const ids = Array.from(new Set(sorted.map((a) => a.userId)));
        const summaries = await lookupUsers(ids).catch(() => []);
        setUsers(Object.fromEntries(summaries.map((u) => [u.id, u])));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load SOS alerts."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 10000);
    return () => window.clearInterval(id);
     
  }, []);

  async function handleAcknowledge(id: string) {
    setActingOn(id);
    try {
      await acknowledgeSos(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't acknowledge this alert.");
    } finally {
      setActingOn(null);
    }
  }

  async function handleResolve(id: string) {
    setActingOn(id);
    try {
      await resolveSos(id, notesDraft[id]?.trim() || undefined);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't resolve this alert.");
    } finally {
      setActingOn(null);
    }
  }

  const active = alerts.filter((a) => a.status !== "RESOLVED");
  const resolved = alerts.filter((a) => a.status === "RESOLVED").slice(0, 10);

  if (loading) {
    return (
      <div className="empty-state">
        <Spinner dark />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h2>SOS alerts</h2>
        <p>Every triggered alert, most recent first. This list refreshes automatically.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {active.length === 0 ? (
        <div className="empty-state">
          <div className="glyph">✓</div>
          <p>No active alerts right now.</p>
        </div>
      ) : (
        <div>
          {active.map((alert) => {
            const user = users[alert.userId];
            return (
              <div key={alert.id} className="list-row" style={{ alignItems: "flex-start" }}>
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row-between" style={{ gap: 10 }}>
                    <strong>{user?.name ?? user?.phone ?? "Member"}</strong>
                    <span className={`badge ${STATUS_BADGE[alert.status].cls}`}>{STATUS_BADGE[alert.status].label}</span>
                  </div>
                  <span className="muted">Triggered {formatDateTime(alert.triggeredAt)}</span>
                  {alert.status === "ACKNOWLEDGED" && (
                    <input
                      type="text"
                      placeholder="Resolution notes (optional)"
                      value={notesDraft[alert.id] ?? ""}
                      onChange={(e) => setNotesDraft((prev) => ({ ...prev, [alert.id]: e.target.value }))}
                      style={{ maxWidth: 320 }}
                    />
                  )}
                </div>
                <div className="stack" style={{ gap: 8, minWidth: 130 }}>
                  {alert.status === "TRIGGERED" && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={actingOn === alert.id}
                    >
                      {actingOn === alert.id ? <Spinner /> : "Acknowledge"}
                    </button>
                  )}
                  {alert.status === "ACKNOWLEDGED" && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleResolve(alert.id)}
                      disabled={actingOn === alert.id}
                    >
                      {actingOn === alert.id ? <Spinner dark /> : "Mark resolved"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: 10 }}>
            Recently resolved ({resolved.length})
          </summary>
          <div>
            {resolved.map((alert) => (
              <div key={alert.id} className="list-row">
                <div>
                  <strong>{users[alert.userId]?.name ?? users[alert.userId]?.phone ?? "Member"}</strong>
                  <div className="muted">
                    {formatDateTime(alert.triggeredAt)}
                    {alert.responseTimeSeconds != null ? ` · resolved in ${Math.round(alert.responseTimeSeconds / 60)} min` : ""}
                  </div>
                </div>
                <span className="badge badge-good">Resolved</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
