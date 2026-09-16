import { useState, type FormEvent } from 'react';

import elnoLogo from '../assets/elno-logo.png';
import { useAuth } from '../core/auth/AuthContext';

export function LoginPage() {
  const { login, status, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isLoading = status === 'loading';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login(email.trim(), password).catch(() => {
      // Error is already captured by AuthContext — nothing else to do here.
    });
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={elnoLogo} alt="ELNO" className="login-logo" />
        <p className="page-subtitle">Powered by OVOKO France</p>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading || !email || !password}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
