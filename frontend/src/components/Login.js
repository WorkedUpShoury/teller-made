import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./signin.css"; // dedicated CSS only for Login
import logo from '../styles/logo.png';
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
      if (data.token) localStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/"); // Redirect after login
    } catch (err) {
      console.error(err);
      setError("Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root  login-neo">
      <div className="login-card" aria-busy={loading}>
        <div className="login-logo">
    <img src= {logo} alt="TellerMade Logo" />
      </div>
        <header className="login-head">
          <span className="login-badge" aria-hidden>
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
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Sign in to TellerMade</p>
          </div>
        </header>

        <form onSubmit={handleLogin} className="login-form" noValidate>
          {error && (
            <div role="alert" className="login-alert">
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
                {showPw ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    stroke="currentColor"
                    fill="none"
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5.05 0-9.33-3.2-11-8 1.05-2.99 3.2-5.47 6-7m3-1a9.77 9.77 0 0 1 2-.2c5.05 0 9.33 3.2 11 8a10.94 10.94 0 0 1-2.06 3.34M1 1l22 22" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    stroke="currentColor"
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M2.1 12.9A10.94 10.94 0 0 1 12 4c5.05 0 9.33 3.2 11 8-1.67 4.8-5.95 8-11 8a10.94 10.94 0 0 1-9.9-7.1z" />
                  </svg>
                )}
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

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        <p className="login-foot">
          New to TellerMade?{" "}
          <Link to="/register" className="link-strong">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
