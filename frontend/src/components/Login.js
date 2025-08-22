import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Failed to log in with Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-card" aria-busy={loading}>
        <header className="auth-head">
          <span className="auth-badge" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2">
              <path d="M7 10V7a5 5 0 0 1 10 0v3" />
              <rect x="5" y="10" width="14" height="10" rx="2" />
            </svg>
          </span>
          <div>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to TellerMade</p>
          </div>
        </header>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="btn btn-google"
          disabled={loading}
          aria-label="Sign in with Google"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={handleLogin} className="auth-form" noValidate>
          {error && (
            <div role="alert" className="auth-alert">
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              required
              placeholder="e.g. user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="form-meta">
            <div className="remember">
              <input id="remember" type="checkbox" />
              <label htmlFor="remember">Remember me</label>
            </div>
            <Link to="/forgot-password" className="link">Forgot password?</Link>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" aria-hidden /> : null}
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        <p className="auth-foot">
          New to TellerMade? <Link to="/register" className="link-strong">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3A12.9 12.9 0 1 1 24 11a12.7 12.7 0 0 1 8.9 3.5l5.7-5.7C34.7 4.3 29.7 2 24 2 11.9 2 2 11.9 2 24s9.9 22 22 22 22-9.9 22-22c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12.9 12.9 0 0 1 24 11c3.4 0 6.6 1.3 8.9 3.5l5.7-5.7C34.7 4.3 29.7 2 24 2 16 2 8.9 6.1 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.6 0 10.7-2.1 14.5-5.6l-6.7-5.5A12.8 12.8 0 0 1 24 37a12.9 12.9 0 0 1-11.2-6.8l-6.6 5C8.9 41.9 15.9 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a13 13 0 0 1-4.4 6l6.7 5.5C39.5 36.9 42 31.8 42 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
