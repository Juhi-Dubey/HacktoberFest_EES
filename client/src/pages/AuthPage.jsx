import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9\s]).{8,}$/;

// One page for both "Log in" and "Sign up"; mode decides which.
export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShowPassword(false);
    setError('');
  }, [mode]);

  function handleTeamNameKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isSignup) {
        emailInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
    }
  }

  function handleEmailKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordInputRef.current?.focus();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Team name is required');
      return;
    }

    if (isSignup) {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError('Email address is required');
        return;
      }
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        setError('Please enter a valid email address');
        return;
      }
      if (!PASSWORD_REGEX.test(password)) {
        setError(
          'Password must be at least 8 characters long and contain uppercase, lowercase, a digit, and a special character'
        );
        return;
      }
    }

    setBusy(true);
    try {
      if (isSignup) await signup(trimmedUsername, password, email.trim());
      else await login(trimmedUsername, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <h1>{isSignup ? 'Create a team account' : 'Log in'}</h1>
      <p className="muted">You only need an account to submit code. Browsing problems is open to everyone.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Team name
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleTeamNameKeyDown}
            autoComplete="username"
          />
        </label>
        {isSignup && (
          <label>
            Email
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleEmailKeyDown}
              autoComplete="email"
              placeholder="team@example.com"
            />
          </label>
        )}
        <label>
          Password
          {isSignup && (
            <span className="muted" style={{ fontSize: '12px', fontWeight: 'normal' }}>
              Min 8 chars with uppercase, lowercase, digit & special char
            </span>
          )}
          <div className="password-field">
            <input
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
        </button>
      </form>
      <p className="muted">
        {isSignup ? (
          <>
            Already have an account? <Link to="/login">Log in</Link>
          </>
        ) : (
          <>
            New here? <Link to="/signup">Create a team account</Link>
          </>
        )}
      </p>
    </section>
  );
}
