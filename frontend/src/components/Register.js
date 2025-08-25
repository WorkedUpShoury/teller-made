import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';


function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:5001/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name,
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Registered successfully! Please login now.");
        navigate("/login"); // redirect to login after success
      } else {
        setError(data.error || "Registration failed. Try again.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("Something went wrong. Please try again later.");
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: "500px" }}>
      <h2 className="text-center mb-4">📝 Register for TellerMade</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleRegister}>
        <div className="mb-3">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            required
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Doe"
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Email address</label>
          <input
            type="email"
            required
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. john@example.com"
          />
        </div>

        <div className="mb-4">
          <label className="form-label">Password</label>
          <input
            type="password"
            required
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a secure password"
          />
        </div>

        <button type="submit" className="btn btn-success w-100">
          Register
        </button>
      </form>

      <p className="text-center mt-3">
        Already a member? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}

export default Register;
