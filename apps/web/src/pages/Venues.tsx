import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listVenues } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TopBar } from "../components/TopBar";
import type { Venue } from "../api/types";

const TIER_LABELS: Record<Venue["tier"], string> = {
  CAFE: "Café",
  MID: "Mid-tier",
  PREMIUM: "Premium",
  LUXURY: "Luxury",
};

export function Venues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    listVenues(tierFilter ? { tier: tierFilter } : {})
      .then(setVenues)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load venues."))
      .finally(() => setLoading(false));
  }, [tierFilter]);

  return (
    <>
      <TopBar title="Venues" />
      <div className="screen">
        <div className="chip-grid" style={{ marginBottom: 16 }}>
          {["", "CAFE", "MID", "PREMIUM", "LUXURY"].map((t) => (
            <button
              key={t || "all"}
              className={`chip ${tierFilter === t ? "selected" : ""}`}
              onClick={() => setTierFilter(t)}
            >
              {t ? TIER_LABELS[t as Venue["tier"]] : "All"}
            </button>
          ))}
        </div>

        {loading && (
          <div className="empty-state">
            <Spinner dark />
          </div>
        )}

        {!loading && error && <div className="error-banner">{error}</div>}

        {!loading && !error && venues.length === 0 && (
          <div className="empty-state">
            <div className="glyph">☕</div>
            <p>No venues here yet. Check back soon.</p>
          </div>
        )}

        <div className="stack">
          {venues.map((venue) => (
            <div key={venue.id} className="card card-tap" onClick={() => navigate(`/venues/${venue.id}`)}>
              <div className="row-between">
                <h3>{venue.name}</h3>
                <span className="tier-pill">{TIER_LABELS[venue.tier]}</span>
              </div>
              <p style={{ marginBottom: 0 }}>
                {venue.addressLine}, {venue.city}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
