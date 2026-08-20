import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { loginWithSession } = useAuth();
  const [step, setStep] = useState("credentials"); // credentials -> otp
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.login(username, password);
      if (data.otp_required) {
        setStep("otp");
      } else {
        loginWithSession(data);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp(username, code);
      loginWithSession(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mu-auth-shell">
      <div className="mu-auth-card">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <i className="bi bi-mortarboard-fill" style={{ fontSize: "2rem", color: "var(--mu-gold-dark)" }} />
          <h2 style={{ margin: "10px 0 2px" }}>Muranga University</h2>
          <p style={{ color: "var(--mu-text-muted)", margin: 0 }}>Student & Staff Portal</p>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentials}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Registration / Employee Number</label>
            <input
              className="mu-input"
              style={inputStyle}
              placeholder="e.g. SC211/0530/2022"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Password</label>
            <input
              type="password"
              style={inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p style={{ color: "var(--mu-danger)", fontSize: "0.85rem" }}>{error}</p>}
            <button className="mu-btn mu-btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtp}>
            <p style={{ fontSize: "0.85rem", color: "var(--mu-text-muted)" }}>
              A 6-digit verification code was sent for <strong>{username}</strong>.
            </p>
            <input
              style={{ ...inputStyle, letterSpacing: "0.3em", textAlign: "center", fontWeight: 700 }}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            {error && <p style={{ color: "var(--mu-danger)", fontSize: "0.85rem" }}>{error}</p>}
            <button className="mu-btn mu-btn-gold" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Verifying..." : "Verify & continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  marginTop: 6,
  marginBottom: 16,
  borderRadius: 8,
  border: "1px solid var(--mu-border)",
  fontSize: "0.9rem",
};
