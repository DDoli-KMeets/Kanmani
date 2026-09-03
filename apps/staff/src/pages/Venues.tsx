import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  assignVenueStaff,
  createVenue,
  findUserByPhone,
  listMyVenues,
  setStaffRole,
  verifyCctv,
} from "../api/endpoints";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import type { UserSummary, Venue } from "../api/types";

const TIERS: Venue["tier"][] = ["CAFE", "MID", "PREMIUM", "LUXURY"];

function StatusBadge({ venue }: { venue: Venue }) {
  if (venue.status === "ACTIVE") return <span className="badge badge-good">Active</span>;
  if (venue.status === "PENDING_ONBOARDING") return <span className="badge badge-warn">Pending CCTV verification</span>;
  return <span className="badge badge-neutral">{venue.status}</span>;
}

export function Venues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [tier, setTier] = useState<Venue["tier"]>("CAFE");
  const [creating, setCreating] = useState(false);

  const [staffPhone, setStaffPhone] = useState("");
  const [staffVenueId, setStaffVenueId] = useState("");
  const [staffLookup, setStaffLookup] = useState<UserSummary | null>(null);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffMessage, setStaffMessage] = useState<string | null>(null);

  function load() {
    listMyVenues()
      .then((rows) => {
        setVenues(rows);
        if (rows[0]) setStaffVenueId(rows[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load venues."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleVerify(id: string) {
    setVerifying(id);
    try {
      await verifyCctv(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't verify this venue.");
    } finally {
      setVerifying(null);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !addressLine.trim() || !city.trim()) {
      setError("Fill in every field to create a venue.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createVenue({ name: name.trim(), addressLine: addressLine.trim(), city: city.trim(), tier });
      setName("");
      setAddressLine("");
      setCity("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this venue.");
    } finally {
      setCreating(false);
    }
  }

  async function handleLookup() {
    setStaffMessage(null);
    setStaffLookup(null);
    if (!/^[6-9]\d{9}$/.test(staffPhone)) {
      setStaffMessage("Enter a valid 10-digit mobile number.");
      return;
    }
    setStaffBusy(true);
    try {
      const user = await findUserByPhone(`+91${staffPhone}`);
      setStaffLookup(user);
    } catch (err) {
      setStaffMessage(err instanceof ApiError ? err.message : "Couldn't find that account.");
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleAssign() {
    if (!staffLookup || !staffVenueId) return;
    setStaffBusy(true);
    setStaffMessage(null);
    try {
      await assignVenueStaff(staffVenueId, staffLookup.id);
      setStaffMessage(`${staffLookup.name ?? staffLookup.phone} is now venue staff at this venue.`);
      setStaffLookup(null);
      setStaffPhone("");
    } catch (err) {
      setStaffMessage(err instanceof ApiError ? err.message : "Couldn't assign this person.");
    } finally {
      setStaffBusy(false);
    }
  }

  async function handlePromote(role: "TRUST_AND_SAFETY" | "SUPER_ADMIN") {
    if (!staffLookup) return;
    setStaffBusy(true);
    setStaffMessage(null);
    try {
      await setStaffRole(staffLookup.id, role);
      setStaffMessage(`${staffLookup.name ?? staffLookup.phone} is now ${role.replace(/_/g, " ").toLowerCase()}.`);
      setStaffLookup(null);
      setStaffPhone("");
    } catch (err) {
      setStaffMessage(err instanceof ApiError ? err.message : "Couldn't update this person's role.");
    } finally {
      setStaffBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Venues</h2>
        <p>Create venues, verify their CCTV before they go live, and assign staff.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Add a venue</h3>
        <form className="stack" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="v-name">Name</label>
            <input id="v-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="v-address">Address</label>
            <input id="v-address" type="text" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="v-city">City</label>
            <input id="v-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>Tier</label>
            <div className="chip-grid">
              {TIERS.map((t) => (
                <button type="button" key={t} className={`chip ${tier === t ? "selected" : ""}`} onClick={() => setTier(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={creating} style={{ width: "auto" }}>
            {creating ? <Spinner /> : "Create venue"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Assign staff or promote a member</h3>
        <p>Look up a member by their phone number, then assign them to a venue or grant them a role.</p>
        <div className="stack">
          <div className="row-between" style={{ gap: 8 }}>
            <input
              type="tel"
              placeholder="10-digit phone number"
              value={staffPhone}
              onChange={(e) => setStaffPhone(e.target.value.replace(/\D/g, ""))}
              maxLength={10}
            />
            <button className="btn btn-outline" onClick={handleLookup} disabled={staffBusy} style={{ width: "auto" }}>
              {staffBusy ? <Spinner dark /> : "Look up"}
            </button>
          </div>

          {staffMessage && <div className="info-banner">{staffMessage}</div>}

          {staffLookup && (
            <div className="card" style={{ background: "var(--cream-100)" }}>
              <div className="row-between">
                <strong>{staffLookup.name ?? "(no name yet)"}</strong>
                <span className="muted">{staffLookup.phone}</span>
              </div>
              <p style={{ marginTop: 4, marginBottom: 12 }}>
                Currently: <span className="mono">{staffLookup.role}</span>
              </p>

              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="assign-venue">Assign as venue staff at</label>
                <div className="row-between" style={{ gap: 8 }}>
                  <select id="assign-venue" value={staffVenueId} onChange={(e) => setStaffVenueId(e.target.value)}>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={handleAssign} disabled={staffBusy} style={{ width: "auto" }}>
                    Assign
                  </button>
                </div>
              </div>

              <div className="row-between">
                <button className="btn btn-secondary" onClick={() => handlePromote("TRUST_AND_SAFETY")} disabled={staffBusy}>
                  Make Trust & Safety
                </button>
                <button className="btn btn-outline" onClick={() => handlePromote("SUPER_ADMIN")} disabled={staffBusy}>
                  Make Super Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <Spinner dark />
        </div>
      ) : (
        <div>
          {venues.map((v) => (
            <div key={v.id} className="list-row">
              <div>
                <div className="row-between" style={{ gap: 10 }}>
                  <strong>{v.name}</strong>
                  <StatusBadge venue={v} />
                </div>
                <span className="muted">
                  {v.addressLine}, {v.city} · {v.tier}
                </span>
              </div>
              {v.status === "PENDING_ONBOARDING" && (
                <button className="btn btn-primary" onClick={() => handleVerify(v.id)} disabled={verifying === v.id}>
                  {verifying === v.id ? <Spinner /> : "Verify CCTV & activate"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
