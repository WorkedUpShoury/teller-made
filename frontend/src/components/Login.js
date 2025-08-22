import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate for redirection
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'; // Import Firebase functions
import { auth, googleProvider } from '../firebase'; // Import your Firebase config

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Handler for traditional email/password login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard'); // Redirect to a dashboard or home page after login
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
      console.error(err);
    }
    setLoading(false);
  };

  // Handler for Google popup login
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/dashboard'); // Redirect after successful Google login
    } catch (err) {
      setError('Failed to log in with Google.');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="container py-5" style={{ maxWidth: '500px' }}>
      <h2 className="text-center mb-4">🔐 Login to TellerMade</h2>

      {/* Google Login Button */}
      <button
        onClick={handleGoogleLogin}
        className="btn btn-light w-100 mb-3 d-flex align-items-center justify-content-center"
        disabled={loading}
        style={{ border: '1px solid #ddd' }}
      >
        <img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" alt="Google logo" style={{ height: '20px', marginRight: '10px' }} />
        Sign in with Google
      </button>
      
      <p className="text-center">or</p>

      {/* Email/Password Form */}
      <form onSubmit={handleLogin}>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="mb-3">
          <label className="form-label">Email address</label>
          <input
            type="email"
            required
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. user@example.com"
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
            placeholder="••••••••"
          />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p className="text-center mt-3">
        New to TellerMade? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}

export default Login;