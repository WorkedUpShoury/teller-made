import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
      const res = await fetch("http://localhost:5001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Save token/user info if backend returns it
      localStorage.setItem("token", data.token || "");
      localStorage.setItem("user", JSON.stringify(data.user || {}));

      navigate("/dashboard"); // Redirect after login
    } catch (err) {
      console.error(err);
      setError("Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-card" aria-busy={loading}>
        <header className="auth-head">
          <span className="auth-badge" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path d="M7 10V7a5 5 0 0 1 10 0v3" />
              <rect x="5" y="10" width="14" height="10" rx="2" />
            </svg>
          </span>
          <div>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to TellerMade</p>
          </div>
        </header>

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
            <Link to="/forgot-password" className="link">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" aria-hidden /> : null}
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        <p className="auth-foot">
          New to TellerMade?{" "}
          <Link to="/register" className="link-strong">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

