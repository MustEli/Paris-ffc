import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import elnoLogo from '../assets/elno-logo.png';
import { useAuth } from '../core/auth/AuthContext';
import { setLanguage } from '../core/i18n/config';

export function LoginPage() {
  const { t, i18n } = useTranslation('login');
  const { login, status, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
        <button
          type="button"
          className="login-lang-toggle"
          onClick={() => setLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
          title={t('language', { ns: 'common' })}
        >
          {i18n.language === 'fr' ? 'FR' : 'EN'}
        </button>
        <div className="login-card-body">
          <div className="login-logo-row">
            <img src={elnoLogo} alt="" className="login-logo" />
            <div className="login-logo-text">
              <div className="login-logo-wordmark">
                <span className="login-logo-elno">ELNO</span> <span className="login-logo-team">TEAM</span>
              </div>
              <span className="login-logo-tag">{t('tagline')}</span>
            </div>
          </div>

          <h1 className="login-title">{t('title')}</h1>
          <p className="login-subtitle">{t('subtitle')}</p>

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
              <div className="login-password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  title={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn btn-accent" disabled={isLoading || !email || !password}>
              {isLoading ? t('signingIn') : t('signIn')}
            </button>
          </form>

          <p className="login-help">
            {t('needHelp')} <span className="login-help-link">{t('contactAdmin')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
