import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cancelEventRsvp, listEvents, myEventRsvps, rsvpToEvent } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TopBar } from "../components/TopBar";
import { formatDateTime, formatRupees } from "../utils/format";
import type { CommunityEvent, EventRsvp } from "../api/types";

const EVENT_TYPE_LABEL: Record<CommunityEvent["eventType"], string> = {
  trip: "Weekend trip",
  trail_run: "Trail run",
  farm_day: "Farm day",
  other: "Meetup",
};

export function Community() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    Promise.all([listEvents(), myEventRsvps()])
      .then(([e, r]) => {
        setEvents(e.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)));
        setRsvps(r);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load events."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function rsvpFor(eventId: string): EventRsvp | undefined {
    return rsvps.find((r) => r.eventId === eventId && r.status !== "CANCELLED");
  }

  async function handleRsvp(eventId: string) {
    setActingOn(eventId);
    try {
      const res = await rsvpToEvent(eventId);
      if (res.payment) {
        navigate(`/pay/${res.payment.id}`);
        return;
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't RSVP to this event.");
    } finally {
      setActingOn(null);
    }
  }

  async function handleCancel(eventId: string) {
    setActingOn(eventId);
    try {
      await cancelEventRsvp(eventId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel your RSVP.");
    } finally {
      setActingOn(null);
    }
  }

  return (
    <>
      <TopBar title="Community" />
      <div className="screen">
        <p>Group trips and activities beyond café meetups — open to any verified member.</p>

        {loading && (
          <div className="empty-state">
            <Spinner dark />
          </div>
        )}

        {!loading && error && <div className="error-banner">{error}</div>}

        {!loading && !error && events.length === 0 && (
          <div className="empty-state">
            <div className="glyph">✦</div>
            <p>No community events scheduled right now.</p>
          </div>
        )}

        <div className="stack">
          {events.map((event) => {
            const mine = rsvpFor(event.id);
            const acting = actingOn === event.id;
            return (
              <div key={event.id} className="card">
                <div className="row-between">
                  <h3>{event.title}</h3>
                  <span className="tier-pill">{EVENT_TYPE_LABEL[event.eventType]}</span>
                </div>
                <p>{event.description}</p>
                <div className="row-between">
                  <span className="muted">{formatDateTime(event.startsAt)}</span>
                  <strong>{event.priceRupees > 0 ? formatRupees(event.priceRupees * 100) : "Free"}</strong>
                </div>
                {event.locationText && <p className="muted" style={{ marginTop: 6 }}>{event.locationText}</p>}
                <hr className="divider" />
                {mine ? (
                  <div className="stack">
                    <span className={`badge ${mine.status === "WAITLIST" ? "badge-warn" : "badge-good"}`}>
                      {mine.status === "WAITLIST" ? "Waitlisted" : "You're going"}
                    </span>
                    <button className="btn btn-outline btn-sm" onClick={() => handleCancel(event.id)} disabled={acting}>
                      {acting ? <Spinner dark /> : "Cancel RSVP"}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => handleRsvp(event.id)} disabled={acting}>
                    {acting ? <Spinner /> : "RSVP"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
