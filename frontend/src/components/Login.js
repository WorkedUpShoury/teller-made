// Top of your file
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import "./signin.css"; 
import logo from "../styles/logo.png";


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

/* ------------------ Email/Password Login ------------------ */
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
    if (!res.ok) throw new Error(data.error || "Login failed");

    // --- ✅ ADD THIS LINE ---
    localStorage.setItem("token", data.token);
    // -------------------------

    localStorage.setItem("user", JSON.stringify(data.user));
    navigate("/");
    window.location.reload();
  } catch (err) {
    console.error(err);
    setError("Failed to log in. Please check your credentials.");
  } finally {
    setLoading(false);
  }
};

  /* ------------------ Google Login ------------------ */
  const handleGoogleSuccess = (credentialResponse) => {
    if (!credentialResponse.credential) {
      setError("Google login failed. No credential received.");
      return;
    }

    try {
      const decoded = jwtDecode(credentialResponse.credential);
      console.log("Google User Decoded:", decoded);

      // Send token to backend for verification
      fetch("http://localhost:5001/api/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: credentialResponse.credential }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            localStorage.setItem("user", JSON.stringify(data.user));
            navigate("/");
            window.location.reload();
          } else {
            setError("Google login failed on server.");
          }
        })
        .catch((err) => {
          console.error(err);
          setError("Google login failed.");
        });
    } catch (err) {
      console.error("JWT Decode error:", err);
      setError("Invalid Google token.");
    }
  };

  const handleGoogleError = () => {
    setError("Google login was unsuccessful. Please try again.");
  };

  return (
    <div className="login-root login-neo">
      <div className="login-card" aria-busy={loading}>
        <div className="login-logo">
          <img src={logo} alt="TellerMade Logo" />
        </div>
        <header className="login-head">
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">Sign in to TellerMade</p>
        </header>

        <form onSubmit={handleLogin} className="login-form" noValidate>
          {error && <div role="alert" className="login-alert">{error}</div>}

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
              >
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        {/* ✅ Google Login Button */}
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
        </div>

        <p className="login-foot">
          New to TellerMade?{" "}
          <Link to="/register" className="link-strong">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
