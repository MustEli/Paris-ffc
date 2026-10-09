import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchSearch, type PalletSearchResult, type StaffSearchResult, type TaskSearchResult } from '../core/api/search';
import { useAuth } from '../core/auth/AuthContext';

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
 * The global header from the customer's spec. Per the resolved scope
 * ("1. Elno first. 2. Leave it for now. ... 4. just set the switcher
 * option place and design ... 5/6. Leave it for now. 7. Yes fully
 * functional"): the language switcher, live-status dot, and
 * notification bell are visual placeholders only — search is the one
 * fully wired piece.
 */
export function TopHeader() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'FR'>('EN');
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
          <input
            type="text"
            placeholder="Search by Pallet ID, Box #, Seller Name, Staff Name, or Task ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
          />
          {showDropdown && (
            <div className="top-header-search-dropdown">
              {isFetching && <div className="top-header-search-empty">Searching…</div>}
              {!isFetching && !hasResults && <div className="top-header-search-empty">No matches.</div>}
              {!isFetching && data && data.pallets.length > 0 && (
                <div className="top-header-search-group">
                  <div className="top-header-search-group-label">Pallets</div>
                  {data.pallets.map((p) => (
                    <button key={p.id} className="top-header-search-result" onClick={() => goToPallet(p)}>
                      <strong>{p.palletIndex}</strong> — {p.sellerName} ({p.boxNumber})
                    </button>
                  ))}
                </div>
              )}
              {!isFetching && data && data.staff.length > 0 && (
                <div className="top-header-search-group">
                  <div className="top-header-search-group-label">Staff</div>
                  {data.staff.map((s) => (
                    <button key={s.id} className="top-header-search-result" onClick={() => goToStaff(s)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              {!isFetching && data && data.tasks.length > 0 && (
                <div className="top-header-search-group">
                  <div className="top-header-search-group-label">Tasks</div>
                  {data.tasks.map((t) => (
                    <button key={t.id} className="top-header-search-result" onClick={() => goToTask(t)}>
                      {t.label}
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
            onClick={() => setLanguage((l) => (l === 'EN' ? 'FR' : 'EN'))}
            title="Language (display only for now)"
          >
            {language}
          </button>

          <div className="top-header-status" title="Live System Status">
            <span className="top-header-status-dot" />
            <span className="top-header-status-label">Live</span>
          </div>

          <button type="button" className="top-header-bell" title="Notifications">
            🔔
            <span className="top-header-bell-badge" />
          </button>

          <div className="top-header-profile" ref={profileRef}>
            <button type="button" className="top-header-profile-trigger" onClick={() => setIsProfileOpen((v) => !v)}>
              <span className="top-header-avatar">{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
              <span className="top-header-profile-name">{user?.name}</span>
            </button>
            {isProfileOpen && (
              <div className="top-header-profile-dropdown">
                <button type="button" className="top-header-profile-dropdown-item" onClick={logout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
