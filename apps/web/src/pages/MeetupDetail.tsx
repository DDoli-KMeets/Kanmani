import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cancelBooking, getBooking, getConnectionStatus } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TopBar } from "../components/TopBar";
import { useSetActiveBooking } from "../state/ActiveBookingContext";
import { formatDateTime, formatRupees } from "../utils/format";
import type { Booking, ConnectionStatus, CounterpartRevealed } from "../api/types";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Man",
  FEMALE: "Woman",
  NON_BINARY: "Non-binary",
  PREFER_NOT_TO_SAY: "Prefers not to say",
};

const STATUS_LABEL: Record<Booking["status"], string> = {
  PENDING_MATCH: "We're finding you a match",
  MATCHED: "Matched — head to the venue at your slot time",
  CONFIRMED: "Confirmed — head to the venue at your slot time",
  CHECKED_IN: "You've checked in",
  COMPLETED: "This meetup happened",
  CANCELLED: "Cancelled",
  NO_SHOW: "Marked as a no-show",
};

export function MeetupDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const navigate = useNavigate();

  function load() {
    if (!bookingId) return;
    getBooking(bookingId)
      .then(setBooking)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this meetup."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [bookingId]);
  useSetActiveBooking(booking?.id);

  // Only worth checking once a review could exist at all, and pointless to
  // re-poll forever if it's mine to answer still or theirs never comes.
  useEffect(() => {
    if (!bookingId || !booking) return;
    const canHaveReviewed = booking.status === "CHECKED_IN" || booking.status === "COMPLETED";
    if (!canHaveReviewed) return;
    getConnectionStatus(bookingId)
      .then(setConnection)
      .catch(() => {
        /* non-critical — the rest of the page still works without this */
      });
    // Deliberately keyed on booking?.status alone, not the whole `booking`
    // object — the poll effect below refreshes that object every 8s while
    // waiting on a match/reveal, which would otherwise re-fetch this on
    // every poll tick instead of just when status actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, booking?.status]);

  // While waiting to be matched, or waiting for the counterpart to check
  // in, poll gently so the reveal happens without the member refreshing.
  useEffect(() => {
    if (!booking) return;
    const stillWaiting = booking.status === "PENDING_MATCH" || (booking.match && !booking.match.revealed);
    if (!stillWaiting) return;
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.status, booking?.match?.revealed]);

  async function handleCancel() {
    if (!bookingId) return;
    setCancelling(true);
    try {
      await cancelBooking(bookingId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel this meetup.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner dark />
      </div>
    );
  }

  if (!booking) {
    return (
      <>
        <TopBar title="Meetup" back />
        <div className="screen">
          <div className="error-banner">{error ?? "Meetup not found."}</div>
        </div>
      </>
    );
  }

  const canCancel = booking.status === "PENDING_MATCH" || booking.status === "MATCHED" || booking.status === "CONFIRMED";
  const canReviewOrReport = booking.status === "CHECKED_IN" || booking.status === "COMPLETED";
  const revealed = booking.match?.revealed ?? false;
  const counterpart = booking.match?.counterpart;

  return (
    <>
      <TopBar title="Meetup details" back />
      <div className="screen no-nav">
        <div className="stack">
          <div className="card">
            <span className="muted">{STATUS_LABEL[booking.status]}</span>
            <hr className="divider" />
            <div className="row-between">
              <span>When</span>
              <strong>{formatDateTime(booking.slotDate)}</strong>
            </div>
            <div className="row-between">
              <span>You paid</span>
              <strong>{formatRupees(booking.pricePaidPaise)}</strong>
            </div>
          </div>

          {(booking.status === "MATCHED" || booking.status === "CONFIRMED") && (
            <div className="info-banner">
              At the venue, read venue staff this code so they know it's you: <strong>{booking.reference}</strong>
            </div>
          )}

          {booking.match && (
            <div className="stack">
              <h3>Your match</h3>
              {revealed ? (
                <div className="counterpart-card">
                  <div className="avatar-blur">
                    {(counterpart as CounterpartRevealed).name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <strong>{(counterpart as CounterpartRevealed).name}</strong>
                    <p style={{ marginBottom: 0 }}>
                      {counterpart?.ageRange ? `${counterpart.ageRange} · ` : ""}
                      {counterpart?.gender ? GENDER_LABEL[counterpart.gender] ?? counterpart.gender : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="counterpart-card">
                  <div className="avatar-blur">?</div>
                  <div>
                    <span className="badge badge-hidden">Hidden until you both check in</span>
                    <p style={{ marginBottom: 0, marginTop: 6 }}>
                      {counterpart?.ageRange ? `${counterpart.ageRange} · ` : ""}
                      {counterpart?.gender ? GENDER_LABEL[counterpart.gender] ?? counterpart.gender : ""}
                    </p>
                  </div>
                </div>
              )}
              <p className="muted" style={{ marginBottom: 0 }}>
                {revealed
                  ? "You've both checked in at the venue — say hi!"
                  : "Their name and photo only appear once venue staff have checked both of you in."}
              </p>
            </div>
          )}

          {connection?.mutual && (
            <div className="info-banner">You both said you'd like to stay connected — nice!</div>
          )}
          {connection?.iHaveReviewed && connection.iWantToConnect && !connection.mutual && (
            <p className="muted" style={{ marginBottom: 0 }}>
              You said you'd like to stay connected — we'll let you know if they say the same.
            </p>
          )}

          {error && <div className="error-banner">{error}</div>}

          <div className="stack">
            {canReviewOrReport && (
              <button className="btn btn-secondary" onClick={() => navigate(`/meetups/${booking.id}/review`)}>
                Leave a review
              </button>
            )}
            {canReviewOrReport && revealed && (
              <button className="btn btn-outline" onClick={() => navigate(`/meetups/${booking.id}/report`)}>
                Report a concern
              </button>
            )}
            {canCancel && (
              <button className="btn btn-outline" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? <Spinner dark /> : "Cancel this meetup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
