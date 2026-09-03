import { useState } from "react";
import { triggerSos } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "./Spinner";

/**
 * The safety-critical control of the whole app (build plan §04/§08). Always
 * visible to a signed-in member, never buried in a menu, never gated behind
 * anything beyond being logged in — matching SosService's own comment that
 * nothing should slow this down. Optionally tied to the member's most
 * recent in-progress meetup so venue staff know where to respond.
 */
export function SosButton({ activeBookingId }: { activeBookingId?: string }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmSos() {
    setSending(true);
    setError(null);
    try {
      await triggerSos(activeBookingId);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the alert. Try again.");
    } finally {
      setSending(false);
    }
  }

  function closeAndReset() {
    setOpen(false);
    setSent(false);
    setError(null);
  }

  return (
    <>
      <div className="sos-fab-wrap">
        <button className="sos-fab" onClick={() => setOpen(true)} aria-label="Trigger SOS alert">
          SOS
        </button>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={sent ? closeAndReset : undefined}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            {!sent ? (
              <div className="stack">
                <h2>Need help right now?</h2>
                <p>
                  This immediately alerts staff at your venue{activeBookingId ? "" : " and K-Meets Trust & Safety"}
                  . Only use this if you feel unsafe or need someone to check on you in person.
                </p>
                {error && <div className="error-banner">{error}</div>}
                <button className="btn btn-danger" onClick={confirmSos} disabled={sending}>
                  {sending ? <Spinner /> : "Send SOS alert"}
                </button>
                <button className="btn btn-outline" onClick={closeAndReset} disabled={sending}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="stack">
                <h2>Alert sent</h2>
                <p>Venue staff have been notified and are on their way. Stay where you are if it's safe to do so.</p>
                <button className="btn btn-primary" onClick={closeAndReset}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
