import { useEffect, useRef, useState } from "react";
import { confirmCheckin, getRoster, listMyVenues } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { formatTime } from "../utils/format";
import type { RosterEntry, Venue } from "../api/types";

const STATUS_BADGE: Record<RosterEntry["status"], { label: string; cls: string }> = {
  MATCHED: { label: "Matched — not yet here", cls: "badge-neutral" },
  CONFIRMED: { label: "Confirmed — not yet here", cls: "badge-neutral" },
  CHECKED_IN: { label: "Checked in", cls: "badge-good" },
};

export function Roster() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  // Which venue the most recent roster request was actually for — lets a
  // response that resolves late (a busier venue's query is slower than one
  // requested after it) be dropped instead of overwriting the roster with
  // stale data for whatever venue is selected by the time it arrives. Real
  // bug, not hypothetical: switching venues quickly enough for this to
  // matter is exactly what a staff member covering multiple venues does.
  const requestedVenueId = useRef<string | null>(null);

  useEffect(() => {
    listMyVenues()
      .then((rows) => {
        setVenues(rows);
        if (rows.length > 0) setVenueId(rows[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your venues."))
      .finally(() => setLoadingVenues(false));
  }, []);

  function loadRoster(id: string) {
    requestedVenueId.current = id;
    setLoadingRoster(true);
    getRoster(id)
      .then((rows) => {
        if (requestedVenueId.current === id) setRoster(rows);
      })
      .catch((err) => {
        if (requestedVenueId.current === id) {
          setError(err instanceof ApiError ? err.message : "Couldn't load the roster.");
        }
      })
      .finally(() => {
        if (requestedVenueId.current === id) setLoadingRoster(false);
      });
  }

  useEffect(() => {
    if (!venueId) return;
    loadRoster(venueId);
    const id = window.setInterval(() => loadRoster(venueId), 15000);
    return () => window.clearInterval(id);
     
  }, [venueId]);

  async function handleCheckin(bookingId: string) {
    setActingOn(bookingId);
    setError(null);
    setLastResult(null);
    try {
      const res = await confirmCheckin(bookingId);
      setLastResult(
        res.revealed
          ? "Checked in — both parties have now arrived, so their names are revealed to each other."
          : "Checked in — waiting on the other person before names are revealed.",
      );
      if (venueId) loadRoster(venueId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't check this booking in.");
    } finally {
      setActingOn(null);
    }
  }

  if (loadingVenues) {
    return (
      <div className="empty-state">
        <Spinner dark />
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="empty-state">
        <div className="glyph">☕</div>
        <p>You're not assigned to any venue yet. Ask an admin to assign you.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Check-in</h2>
        <p>Members read out a short reference code from their app — match it below and tap Check in.</p>
      </div>

      {venues.length > 1 && (
        <div className="venue-picker">
          {venues.map((v) => (
            <button
              key={v.id}
              className={`chip ${venueId === v.id ? "selected" : ""}`}
              onClick={() => setVenueId(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {lastResult && <div className="info-banner">{lastResult}</div>}
      {error && <div className="error-banner">{error}</div>}

      {loadingRoster && roster.length === 0 ? (
        <div className="empty-state">
          <Spinner dark />
        </div>
      ) : roster.length === 0 ? (
        <div className="empty-state">
          <div className="glyph">◎</div>
          <p>No one expected right now.</p>
        </div>
      ) : (
        <div>
          {roster.map((entry) => (
            <div key={entry.id} className="roster-row">
              <div>
                <div className="row-between" style={{ gap: 10 }}>
                  <span className="mono" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                    {entry.reference}
                  </span>
                  <span className={`badge ${STATUS_BADGE[entry.status].cls}`}>
                    {STATUS_BADGE[entry.status].label}
                  </span>
                </div>
                <span className="muted">
                  {formatTime(entry.slotDate)} · {entry.format === "ONE_ON_ONE" ? "1-on-1" : "Group"}
                </span>
              </div>
              {!entry.checkedIn && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleCheckin(entry.id)}
                  disabled={actingOn === entry.id}
                >
                  {actingOn === entry.id ? <Spinner /> : "Check in"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
