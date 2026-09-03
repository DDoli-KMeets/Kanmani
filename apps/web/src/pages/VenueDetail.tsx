import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createBooking, getVenue } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TopBar } from "../components/TopBar";
import { formatRupees } from "../utils/format";
import type { Venue } from "../api/types";

const TIER_PRICE_RUPEES: Record<Venue["tier"], number> = {
  CAFE: 350,
  MID: 750,
  PREMIUM: 1250,
  LUXURY: 1800,
};

function nextAvailableSlots(): { value: string; label: string }[] {
  // The venue doesn't publish a slot calendar yet (a SHOULD-have per the
  // build plan) — for now every booking picks a time at least 2 hours out,
  // matching how the automated tests exercise the booking→match flow.
  const slots: { value: string; label: string }[] = [];
  const base = new Date();
  base.setMinutes(0, 0, 0);
  for (let i = 2; i <= 26; i += 2) {
    const d = new Date(base.getTime() + i * 60 * 60 * 1000);
    slots.push({
      value: d.toISOString(),
      label: d.toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }
  return slots;
}

export function VenueDetail() {
  const { venueId } = useParams<{ venueId: string }>();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<"ONE_ON_ONE" | "GROUP">("ONE_ON_ONE");
  const [slot, setSlot] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const slots = nextAvailableSlots();

  useEffect(() => {
    if (!venueId) return;
    getVenue(venueId)
      .then((v) => {
        setVenue(v);
        setSlot(slots[0]?.value ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this venue."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  async function handleBook() {
    if (!venueId || !slot) return;
    setBooking(true);
    setError(null);
    try {
      const res = await createBooking(venueId, slot, format);
      navigate(`/pay/${res.payment.id}`, { state: { bookingId: res.booking.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't book this slot.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner dark />
      </div>
    );
  }

  if (!venue) {
    return (
      <>
        <TopBar title="Venue" back />
        <div className="screen">
          <div className="error-banner">{error ?? "Venue not found."}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={venue.name} back />
      <div className="screen">
        <div className="stack">
          <div className="card">
            <div className="row-between">
              <span className="muted">{venue.addressLine}, {venue.city}</span>
              <span className="tier-pill">{venue.tier}</span>
            </div>
            <hr className="divider" />
            <div className="row-between">
              <span>Price per person</span>
              <strong>{formatRupees(TIER_PRICE_RUPEES[venue.tier] * 100)}</strong>
            </div>
          </div>

          <div className="field">
            <label>Format</label>
            <div className="chip-grid">
              <button
                className={`chip ${format === "ONE_ON_ONE" ? "selected" : ""}`}
                onClick={() => setFormat("ONE_ON_ONE")}
              >
                1-on-1
              </button>
              <button className={`chip ${format === "GROUP" ? "selected" : ""}`} onClick={() => setFormat("GROUP")}>
                Small group
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="slot">Pick a time</label>
            <select id="slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {slots.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="info-banner">
            You'll pay to hold your slot, then we'll match you with someone who shares your interests. Their name
            and photo stay hidden until you've both checked in at {venue.name}.
          </div>

          {error && (
            <div className="error-banner">
              {error}
              {error.toLowerCase().includes("kyc") && (
                <>
                  {" "}
                  <a href="/kyc" style={{ fontWeight: 700, textDecoration: "underline" }}>
                    Verify now
                  </a>
                </>
              )}
            </div>
          )}

          <button className="btn btn-primary" onClick={handleBook} disabled={booking}>
            {booking ? <Spinner /> : `Book & pay ${formatRupees(TIER_PRICE_RUPEES[venue.tier] * 100)}`}
          </button>
        </div>
      </div>
    </>
  );
}
