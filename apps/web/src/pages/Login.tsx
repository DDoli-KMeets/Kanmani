import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { requestOtp, verifyOtp } from "../api/endpoints";
import { ApiError } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { Spinner } from "../components/Spinner";

const PHONE_PATTERN = /^[6-9]\d{9}$/;

export function Login() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const fullPhone = `+91${phoneDigits}`;

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    if (!PHONE_PATTERN.test(phoneDigits)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await requestOtp(fullPhone);
      setDevCode(res.devCode ?? null);
      if (res.devCode) setCode(res.devCode);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await verifyOtp(fullPhone, code);
      await signIn(res.accessToken, res.refreshToken);
      navigate("/venues", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't verify that code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="brand-mark">K-Meets</div>
      <p style={{ marginBottom: 28 }}>
        A curated meetup with someone new. You stay anonymous until you both actually show up.
      </p>

      {step === "phone" ? (
        <form className="stack" onSubmit={handleRequestOtp}>
          <div className="field">
            <label htmlFor="phone">Mobile number</label>
            <div className="row-between" style={{ gap: 8 }}>
              <span
                style={{
                  border: "1.5px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  background: "#fff",
                  fontWeight: 600,
                }}
              >
                +91
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>
            <span className="hint">We'll text you a 6-digit code to sign in.</span>
          </div>
          {error && <div className="error-banner">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <Spinner /> : "Send code"}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={handleVerify}>
          <div className="field">
            <label htmlFor="code">Enter the code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            <span className="hint">Sent to +91 {phoneDigits}.</span>
          </div>
          {devCode && (
            <div className="hint" style={{ color: "var(--accent, #a83e73)", fontWeight: 600 }}>
              Sandbox mode — no real SMS is sent. Your code is {devCode} (already filled in).
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <Spinner /> : "Verify & continue"}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
            disabled={loading}
          >
            Use a different number
          </button>
        </form>
      )}
    </div>
  );
}
