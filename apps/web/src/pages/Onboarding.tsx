import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { listInterests, updateMe } from "../api/endpoints";
import { ApiError } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { Spinner } from "../components/Spinner";
import type { Interest } from "../api/types";

const GENDERS: { value: string; label: string }[] = [
  { value: "FEMALE", label: "Woman" },
  { value: "MALE", label: "Man" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

const STATUSES: { value: string; label: string }[] = [
  { value: "SINGLE", label: "Single" },
  { value: "IN_A_RELATIONSHIP", label: "In a relationship" },
  { value: "MARRIED", label: "Married" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

const MAX_INTERESTS = 5;

export function Onboarding() {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    listInterests()
      .then(setInterests)
      .catch(() => setInterests([]))
      .finally(() => setLoadingInterests(false));
  }, []);

  function toggleInterest(id: string) {
    setSelectedInterests((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, id];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dob || !gender || !relationshipStatus) {
      setError("Fill in every field before continuing.");
      return;
    }
    if (selectedInterests.length === 0) {
      setError("Pick at least one interest — it's how we find you a good match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updateMe({
        name: name.trim(),
        dateOfBirth: dob,
        gender,
        relationshipStatus,
        interestIds: selectedInterests,
      });
      await refreshProfile();
      navigate("/kyc", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your profile. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const maxDob = new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="screen no-nav">
      <div style={{ paddingTop: 12 }}>
        <h2>Tell us a bit about you</h2>
        <p>This isn't shown to your match until you've both checked in — see how that works on your first booking.</p>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>

        <div className="field">
          <label htmlFor="dob">Date of birth</label>
          <input id="dob" type="date" value={dob} max={maxDob} onChange={(e) => setDob(e.target.value)} />
          <span className="hint">You must be 18 or older to use K-Meets.</span>
        </div>

        <div className="field">
          <label htmlFor="gender">Gender</label>
          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Select one</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="status">Relationship status</label>
          <select id="status" value={relationshipStatus} onChange={(e) => setRelationshipStatus(e.target.value)}>
            <option value="">Select one</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Interests (up to {MAX_INTERESTS})</label>
          {loadingInterests ? (
            <Spinner dark />
          ) : (
            <div className="chip-grid">
              {interests.map((interest) => (
                <button
                  type="button"
                  key={interest.id}
                  className={`chip ${selectedInterests.includes(interest.id) ? "selected" : ""}`}
                  onClick={() => toggleInterest(interest.id)}
                >
                  {interest.name}
                </button>
              ))}
            </div>
          )}
          <span className="hint">
            {selectedInterests.length}/{MAX_INTERESTS} selected
          </span>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <Spinner /> : "Continue"}
        </button>
      </form>
    </div>
  );
}
