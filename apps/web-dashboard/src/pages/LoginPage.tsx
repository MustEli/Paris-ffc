import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import elnoLogo from '../assets/elno-logo.png';
import { useAuth } from '../core/auth/AuthContext';

export function LoginPage() {
  const { t } = useTranslation('login');
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
        <div className="login-card-accent" />
        <div className="login-card-body">
          <div className="login-logo-row">
            <img src={elnoLogo} alt="" className="login-logo" />
            <div className="login-logo-wordmark">
              <span className="login-logo-elno">ELNO</span> <span className="login-logo-team">TEAM</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label" htmlFor="email">
                {t('email')}
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
                {t('password')}
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

            <button type="submit" className="btn btn-accent" disabled={isLoading || !email || !password}>
              {isLoading ? t('signingIn') : t('signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
