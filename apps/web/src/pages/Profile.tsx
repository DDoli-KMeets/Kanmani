import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getKycStatus } from "../api/endpoints";
import { useAuth } from "../state/AuthContext";
import { TopBar } from "../components/TopBar";
import type { KycStatusValue } from "../api/types";

const KYC_BADGE: Record<KycStatusValue, { label: string; cls: string }> = {
  NOT_STARTED: { label: "Not started", cls: "badge-neutral" },
  PENDING: { label: "Reviewing", cls: "badge-warn" },
  VERIFIED: { label: "Verified", cls: "badge-good" },
  REJECTED: { label: "Needs attention", cls: "badge-bad" },
};

export function Profile() {
  const { profile, signOut } = useAuth();
  const [kycStatus, setKycStatus] = useState<KycStatusValue | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getKycStatus()
      .then((res) => setKycStatus(res.status))
      .catch(() => setKycStatus(null));
  }, []);

  if (!profile) return null;

  return (
    <>
      <TopBar title="Profile" />
      <div className="screen">
        <div className="stack">
          <div className="card">
            <h2>{profile.name}</h2>
            <p style={{ marginBottom: 0 }}>{profile.phone}</p>
          </div>

          <div className="card card-tap" onClick={() => navigate("/kyc")}>
            <div className="row-between">
              <span>Identity verification</span>
              {kycStatus && <span className={`badge ${KYC_BADGE[kycStatus].cls}`}>{KYC_BADGE[kycStatus].label}</span>}
            </div>
          </div>

          <div className="card">
            <div className="row-between">
              <span>Gender</span>
              <span className="muted">{profile.gender ?? "—"}</span>
            </div>
            <hr className="divider" />
            <div className="row-between">
              <span>Relationship status</span>
              <span className="muted">{profile.relationshipStatus ?? "—"}</span>
            </div>
            <hr className="divider" />
            <div className="row-between">
              <span>Interests</span>
              <span className="muted">{profile.interests.map((i) => i.name).join(", ") || "—"}</span>
            </div>
          </div>

          <button className="btn btn-outline" onClick={() => navigate("/onboarding")}>
            Edit profile
          </button>

          <button className="btn btn-outline" onClick={() => navigate("/community")}>
            Community events
          </button>

          <button
            className="btn btn-outline"
            onClick={() => {
              signOut();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
