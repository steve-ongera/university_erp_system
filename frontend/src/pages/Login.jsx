import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import muLogo from "../assets/mut_logo.png"; // Make sure this path is correct

export default function Login() {
  const navigate = useNavigate();
  const { loginWithSession } = useAuth();
  const [step, setStep] = useState("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const togglePassword = () => setShowPassword(!showPassword);

  return (
    <div className="mu-auth-shell">
      <div className="mu-auth-card">
        {/* Logo Section */}
        <div className="mu-auth-logo">
          <img 
            src={muLogo} 
            alt="Muranga University" 
            className="mu-auth-logo-img"
          />
          <h2>Muranga University</h2>
          <p>Student & Staff Portal</p>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentials}>
            <div className="mu-form-group">
              <label>Registration / Employee Number</label>
              <div className="mu-input-icon">
                <i className="bi bi-person" />
                <input
                  className="mu-input"
                  placeholder="e.g. SC211/0530/2022"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mu-form-group">
              <label>Password</label>
              <div className="mu-input-icon">
                <i className="bi bi-lock" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="mu-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  className="mu-password-toggle"
                  onClick={togglePassword}
                  tabIndex="-1"
                >
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
              </div>
            </div>

            {error && (
              <div className="mu-alert mu-alert-danger">
                <i className="bi bi-exclamation-triangle" />
                {error}
              </div>
            )}

            <button 
              className="mu-btn mu-btn-primary mu-btn-block" 
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? (
                <>
                  <i className="bi bi-arrow-repeat mu-animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtp}>
            <div className="mu-otp-info">
              <i className="bi bi-shield-lock" />
              <p>
                A 6-digit verification code was sent to your registered email/phone.
                <br />
                <strong>{username}</strong>
              </p>
            </div>

            <div className="mu-form-group">
              <label>Verification Code</label>
              <div className="mu-input-icon">
                <i className="bi bi-pin" />
                <input
                  className="mu-input mu-otp-input"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="mu-alert mu-alert-danger">
                <i className="bi bi-exclamation-triangle" />
                {error}
              </div>
            )}

            <button 
              className="mu-btn mu-btn-primary mu-btn-block" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="bi bi-arrow-repeat mu-animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & continue"
              )}
            </button>

            <button 
              type="button"
              className="mu-btn mu-btn-outline mu-btn-block"
              style={{ marginTop: 8 }}
              onClick={() => {
                setStep("credentials");
                setError("");
                setCode("");
              }}
            >
              <i className="bi bi-arrow-left" />
              Back to login
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mu-auth-footer">
          <span>© 2026 InnovationHub Software Ltd</span>
        </div>
      </div>
    </div>
  );
}