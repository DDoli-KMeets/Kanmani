import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyBookings } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TopBar } from "../components/TopBar";
import { formatDateTime } from "../utils/format";
import type { Booking } from "../api/types";

const STATUS_BADGE: Record<Booking["status"], { label: string; cls: string }> = {
  PENDING_MATCH: { label: "Finding a match", cls: "badge-neutral" },
  MATCHED: { label: "Matched", cls: "badge-hidden" },
  CONFIRMED: { label: "Confirmed", cls: "badge-hidden" },
  CHECKED_IN: { label: "Checked in", cls: "badge-good" },
  COMPLETED: { label: "Completed", cls: "badge-good" },
  CANCELLED: { label: "Cancelled", cls: "badge-bad" },
  NO_SHOW: { label: "No-show", cls: "badge-bad" },
};

export function MyMeetups() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listMyBookings()
      .then((rows) => setBookings(rows.sort((a, b) => +new Date(b.slotDate) - +new Date(a.slotDate))))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your meetups."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <TopBar title="My Meetups" />
      <div className="screen">
        {loading && (
          <div className="empty-state">
            <Spinner dark />
          </div>
        )}

        {!loading && error && <div className="error-banner">{error}</div>}

        {!loading && !error && bookings.length === 0 && (
          <div className="empty-state">
            <div className="glyph">◎</div>
            <p>No meetups booked yet.</p>
            <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => navigate("/venues")}>
              Browse venues
            </button>
          </div>
        )}

        <div className="stack">
          {bookings.map((b) => {
            const badge = STATUS_BADGE[b.status];
            return (
              <div key={b.id} className="card card-tap" onClick={() => navigate(`/meetups/${b.id}`)}>
                <div className="row-between">
                  <span>{formatDateTime(b.slotDate)}</span>
                  <span className={`badge ${badge.cls}`}>{badge.label}</span>
                </div>
                {b.match && (
                  <p style={{ marginTop: 8, marginBottom: 0 }}>
                    {b.match.revealed
                      ? `With ${(b.match.counterpart as { name?: string | null }).name ?? "your match"}`
                      : "Matched — identity revealed once you both check in"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
