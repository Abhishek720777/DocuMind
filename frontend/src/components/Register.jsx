import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

/* Password strength scorer */
function scorePassword(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score; // 0-4 but we map 0-3 to labels
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Strong', 'Very strong'];

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (strength < 2) {
      setError('Please choose a stronger password.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/register/', { username, password });
      await api.post('/login/', { username, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dm-auth-root">
      <style>{AUTH_CSS}</style>
      <nav className="dm-auth-nav">
        <Link to="/" className="dm-brand">
          <svg viewBox="0 0 28 28" className="dm-brand-mark" aria-hidden="true">
            <rect x="5" y="3" width="15" height="20" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <rect x="9" y="7" width="15" height="20" rx="2.4" fill="var(--paper)" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="19.2" cy="12.4" r="1.4" fill="var(--brass)" />
          </svg>
          <span>DocuMind</span>
        </Link>
      </nav>

      <main className="dm-auth-main">
        <div className="dm-auth-card">
          <div className="dm-auth-header">
            <h1>Create account</h1>
            <p>Start building your knowledge base today.</p>
          </div>

          {error && <div className="dm-auth-error">{error}</div>}

          <form onSubmit={handleRegister} className="dm-auth-form">
            <div className="dm-field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="dm-field">
              <label htmlFor="email">Email <span className="dm-field-optional">(optional)</span></label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="dm-field">
              <label htmlFor="password">Password</label>
              <div className="dm-pass-wrap">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="dm-pass-toggle" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {password.length > 0 && (
                <>
                  <div className="dm-strength-bar">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`dm-strength-seg ${i < strength ? `active-${Math.min(strength - 1, 3)}` : ''}`}
                      />
                    ))}
                  </div>
                  <div className={`dm-strength-label s${Math.min(strength, 3)}`}>
                    {STRENGTH_LABELS[strength] || 'Very strong'}
                  </div>
                </>
              )}
            </div>

            <div className="dm-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="dm-pass-wrap">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button type="button" className="dm-pass-toggle" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
              {passwordsMatch && <p className="dm-pass-match ok">✓ Passwords match</p>}
              {passwordsMismatch && <p className="dm-pass-match bad">Passwords don't match</p>}
            </div>

            <button type="submit" className="dm-auth-btn" disabled={loading || passwordsMismatch}>
              {loading ? <span className="dm-auth-spinner" /> : 'Create Account'}
            </button>
          </form>

          <p className="dm-auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default Register;

/* Shared with Login — import from Login.jsx if you prefer */
const AUTH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,340;0,9..144,440;0,9..144,600;1,9..144,440&family=Space+Grotesk:wght@400;500;600;700&display=swap');

.dm-auth-root {
  --paper: #E8ECEE;
  --paper-warm: #F7F4EC;
  --ink: #16233D;
  --ink-soft: #48566E;
  --ink-faint: #8593A6;
  --brass: #B07F26;
  --brass-soft: #E9D8AE;
  --moss: #47624F;
  --line: #C6CFD6;
  --shadow: rgba(22, 35, 61, 0.14);
  --error: #8B2020;
  --error-bg: #FDECEA;

  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Space Grotesk', -apple-system, sans-serif;
  display: flex;
  flex-direction: column;
}
.dm-auth-root *, .dm-auth-root *::before, .dm-auth-root *::after { box-sizing: border-box; }
.dm-auth-root a { color: var(--brass); text-decoration: none; }
.dm-auth-root a:hover { text-decoration: underline; }
.dm-auth-root button { font-family: inherit; cursor: pointer; }
.dm-auth-root :focus-visible { outline: 2px solid var(--brass); outline-offset: 3px; }

.dm-auth-nav {
  padding: 18px 48px;
  border-bottom: 1px solid var(--line);
}
.dm-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Fraunces', serif;
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--ink);
  text-decoration: none !important;
}
.dm-brand:hover { text-decoration: none !important; }
.dm-brand-mark { width: 26px; height: 26px; color: var(--ink); flex-shrink: 0; }

.dm-auth-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.dm-auth-card {
  width: 100%;
  max-width: 440px;
  background: var(--paper-warm);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 44px 40px;
  box-shadow: 0 24px 60px var(--shadow);
}

.dm-auth-header { margin-bottom: 32px; }
.dm-auth-header h1 {
  font-family: 'Fraunces', serif;
  font-weight: 440;
  font-size: 2rem;
  color: var(--ink);
  margin: 0 0 8px;
}
.dm-auth-header p { color: var(--ink-soft); margin: 0; font-size: 0.96rem; }

.dm-auth-error {
  background: var(--error-bg);
  color: var(--error);
  border: 1px solid rgba(139,32,32,0.2);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 24px;
  font-size: 0.92rem;
}

.dm-auth-form { display: flex; flex-direction: column; gap: 20px; }

.dm-field { display: flex; flex-direction: column; gap: 7px; }
.dm-field label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.dm-field-optional {
  font-weight: 400;
  color: var(--ink-faint);
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.82rem;
}
.dm-field input {
  width: 100%;
  padding: 12px 16px;
  background: var(--paper);
  border: 1.5px solid var(--line);
  border-radius: 10px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.96rem;
  color: var(--ink);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  outline: none;
}
.dm-field input::placeholder { color: var(--ink-faint); }
.dm-field input:focus {
  border-color: var(--brass);
  box-shadow: 0 0 0 3px rgba(176,127,38,0.15);
}

.dm-pass-wrap { position: relative; }
.dm-pass-wrap input { padding-right: 46px; }
.dm-pass-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 1rem;
  padding: 4px;
  color: var(--ink-faint);
  line-height: 1;
}

.dm-strength-bar {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}
.dm-strength-seg {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--line);
  transition: background 0.3s ease;
}
.dm-strength-seg.active-0 { background: #C0392B; }
.dm-strength-seg.active-1 { background: #C0392B; }
.dm-strength-seg.active-2 { background: #E67E22; }
.dm-strength-seg.active-3 { background: #2ECC71; }
.dm-strength-label {
  font-size: 0.78rem;
  color: var(--ink-faint);
  margin-top: 5px;
}
.dm-strength-label.s0, .dm-strength-label.s1 { color: #C0392B; }
.dm-strength-label.s2 { color: #E67E22; }
.dm-strength-label.s3 { color: var(--moss); }

.dm-auth-btn {
  margin-top: 8px;
  padding: 14px;
  background: var(--ink);
  color: var(--paper-warm);
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
}
.dm-auth-btn:hover:not(:disabled) { transform: translateY(-1.5px); box-shadow: 0 8px 20px var(--shadow); }
.dm-auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.dm-auth-spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: dm-spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes dm-spin { to { transform: rotate(360deg); } }

.dm-auth-switch {
  margin-top: 28px;
  text-align: center;
  font-size: 0.92rem;
  color: var(--ink-soft);
}

.dm-pass-match {
  font-size: 0.8rem;
  margin-top: 5px;
  margin-bottom: 0;
}
.dm-pass-match.ok { color: #27AE60; }
.dm-pass-match.bad { color: #C0392B; }

@media (max-width: 480px) {
  .dm-auth-card { padding: 32px 24px; }
  .dm-auth-nav { padding: 16px 24px; }
}
`;
