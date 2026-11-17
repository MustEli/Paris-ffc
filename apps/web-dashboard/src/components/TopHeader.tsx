import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown, LogOut, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { fetchSearch, type PalletSearchResult, type StaffSearchResult, type TaskSearchResult } from '../core/api/search';
import { useAuth } from '../core/auth/AuthContext';
import { setLanguage } from '../core/i18n/config';

/** Debounced so every keystroke doesn't fire a request. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * The global header from the customer's spec. The live-status dot and
 * notification bell remain visual placeholders — search and the
 * language switcher are fully wired.
 */
export function TopHeader() {
  const { t, i18n } = useTranslation('common');
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 250);
  const trimmed = debouncedQuery.trim();

  const { data, isFetching } = useQuery({
    queryKey: ['search', trimmed],
    queryFn: () => fetchSearch(token!, trimmed),
    enabled: !!token && trimmed.length >= 2,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function goToPallet(pallet: PalletSearchResult) {
    setIsOpen(false);
    setQuery('');
    navigate(`/reception-intake?highlight=${pallet.id}`);
  }

  function goToStaff(staff: StaffSearchResult) {
    setIsOpen(false);
    setQuery('');
    navigate(`/?highlight=${staff.id}`);
  }

  function goToTask(task: TaskSearchResult) {
    setIsOpen(false);
    setQuery('');
    const path = task.destination === 'task-board' ? '/task-board' : '/';
    navigate(`${path}?highlight=${task.id}`);
  }

  const hasResults = !!data && (data.pallets.length > 0 || data.staff.length > 0 || data.tasks.length > 0);
  const showDropdown = isOpen && trimmed.length >= 2;

  return (
    <header className="top-header">
      <div className="top-header-stripe" />
      <div className="top-header-row">
        <div className="top-header-logo">
          <span className="top-header-logo-elno">Elno</span>
          <span className="top-header-logo-x">x</span>
          <span className="top-header-logo-ovoko">Ovoko</span>
        </div>

        <div className="top-header-search" ref={containerRef}>
          <Search size={15} className="top-header-search-icon" />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
          />
          {showDropdown && (
            <div className="top-header-search-dropdown">
              {isFetching && <div className="top-header-search-empty">{t('search.searching')}</div>}
              {!isFetching && !hasResults && <div className="top-header-search-empty">{t('search.noMatches')}</div>}
              {!isFetching && data && data.pallets.length > 0 && (
                <div className="top-header-search-group">
                  <div className="top-header-search-group-label">{t('search.pallets')}</div>
                  {data.pallets.map((p) => (
                    <button key={p.id} className="top-header-search-result" onClick={() => goToPallet(p)}>
                      <strong>{p.palletIndex}</strong> — {p.sellerName} ({p.boxNumber})
                    </button>
                  ))}
                </div>
              )}
              {!isFetching && data && data.staff.length > 0 && (
                <div className="top-header-search-group">
                  <div className="top-header-search-group-label">{t('search.staff')}</div>
                  {data.staff.map((s) => (
                    <button key={s.id} className="top-header-search-result" onClick={() => goToStaff(s)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              {!isFetching && data && data.tasks.length > 0 && (
                <div className="top-header-search-group">
                  <div className="top-header-search-group-label">{t('search.tasks')}</div>
                  {data.tasks.map((task) => (
                    <button key={task.id} className="top-header-search-result" onClick={() => goToTask(task)}>
                      {task.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="top-header-actions">
          <button
            type="button"
            className="top-header-lang"
            onClick={() => setLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
            title={t('language')}
          >
            {i18n.language === 'fr' ? 'FR' : 'EN'}
          </button>

          <div className="top-header-status" title={t('liveStatus')}>
            <span className="top-header-status-dot" />
            <span className="top-header-status-label">{t('liveStatus')}</span>
          </div>

          <button type="button" className="top-header-bell" title={t('notifications')}>
            <Bell size={17} />
            <span className="top-header-bell-badge" />
          </button>

          <div className="top-header-profile" ref={profileRef}>
            <button type="button" className="top-header-profile-trigger" onClick={() => setIsProfileOpen((v) => !v)}>
              <span className="top-header-avatar">{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
              <span className="top-header-profile-name">{user?.name}</span>
              <ChevronDown size={14} color="#94a3b8" />
            </button>
            {isProfileOpen && (
              <div className="top-header-profile-dropdown">
                <button type="button" className="top-header-profile-dropdown-item" onClick={logout}>
                  <LogOut size={14} />
                  {t('logOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
