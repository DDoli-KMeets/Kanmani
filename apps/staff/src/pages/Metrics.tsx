import { useEffect, useState } from "react";
import { getMetrics } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import type { AdminMetrics } from "../api/types";

const TILES: { key: keyof AdminMetrics; label: string }[] = [
  { key: "totalUsers", label: "Total members" },
  { key: "verifiedUsers", label: "KYC verified" },
  { key: "totalBookings", label: "Bookings" },
  { key: "revealedMeetups", label: "Revealed meetups" },
  { key: "activeVenues", label: "Active venues" },
  { key: "openReports", label: "Open reports" },
  { key: "openSosAlerts", label: "Open SOS alerts" },
];

export function Metrics() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMetrics()
      .then(setMetrics)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load metrics."));
  }, []);

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Overview</h2>
        <p>A plain snapshot of the platform right now — not a historical chart yet.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!metrics && !error && (
        <div className="empty-state">
          <Spinner dark />
        </div>
      )}

      {metrics && (
        <div className="grid-cards">
          {TILES.map((t) => (
            <div key={t.key} className="stat-tile">
              <div className="value">{metrics[t.key]}</div>
              <div className="label">{t.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
