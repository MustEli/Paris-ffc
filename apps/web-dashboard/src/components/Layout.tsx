import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../core/auth/AuthContext';
import { TopHeader } from './TopHeader';

// Labels/order follow the customer's requested sidebar spec, with
// "Task Board" kept as-is (it wasn't in that spec, but has no other
// home). Order Prep/Return Processing/Issue Queue link to
// PlaceholderPage.tsx's "coming soon" pages — nothing is built for
// them yet. "Put-Away & Location Assignment" was removed entirely
// (customer request — locations are predefined/obvious to staff).
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard / Operations Overview', end: true },
  { to: '/task-board', label: 'Task Board' },
  { to: '/schedules', label: 'Attendance & Shift Roster' },
  { to: '/reception-intake', label: 'Reception & Intake' },
  { to: '/reception-reports', label: 'Reception Reports' },
  { to: '/order-prep', label: 'Order Prep (Pick & Pack)' },
  { to: '/return-processing', label: 'Return Processing' },
  { to: '/issue-queue', label: 'Exceptions & Issue Queue' },
  { to: '/reference-lists', label: 'User & Access Management' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell-outer">
      <TopHeader />
      <div className="app-shell">
        <aside className="sidebar">
          <nav>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">{user?.name}</div>
            <button className="btn btn-outline-accent" onClick={logout}>
              Log out
            </button>
          </div>
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
