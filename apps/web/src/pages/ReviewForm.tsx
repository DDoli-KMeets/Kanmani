import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createReview } from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { TopBar } from "../components/TopBar";

export function ReviewForm() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [wantsToConnect, setWantsToConnect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit() {
    if (!bookingId || rating === 0) {
      setError("Pick a star rating first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createReview(bookingId, rating, comment.trim() || undefined, wantsToConnect);
      navigate(`/meetups/${bookingId}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <TopBar title="Leave a review" back />
      <div className="screen no-nav">
        <div className="stack">
          <p>How was your meetup? This helps us keep venues and members accountable.</p>

          <div className="star-row" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={n <= rating ? "filled" : ""}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                ★
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="comment">Comments (optional)</label>
            <textarea
              id="comment"
              value={comment}
              maxLength={1000}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What stood out about the venue or the meetup?"
            />
          </div>

          <label className="row-between" style={{ cursor: "pointer" }}>
            <span>I'd like to stay connected with this person</span>
            <input
              type="checkbox"
              checked={wantsToConnect}
              onChange={(e) => setWantsToConnect(e.target.checked)}
              aria-label="I'd like to stay connected with this person"
            />
          </label>
          <p className="muted" style={{ marginTop: -8 }}>
            Only shared with them if they say the same about you — your answer stays private otherwise.
          </p>

          {error && <div className="error-banner">{error}</div>}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Spinner /> : "Submit review"}
          </button>
        </div>
      </div>
    </>
  );
}
