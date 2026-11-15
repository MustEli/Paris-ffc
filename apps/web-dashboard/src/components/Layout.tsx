import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  RotateCcw,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { type ComponentType, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../core/auth/AuthContext';
import { TopHeader } from './TopHeader';

// Labels/order follow the customer's requested sidebar spec, with
// "Task Board" kept as-is (it wasn't in that spec, but has no other
// home). Order Prep/Return Processing/Issue Queue link to
// PlaceholderPage.tsx's "coming soon" pages — nothing is built for
// them yet. "Put-Away & Location Assignment" was removed entirely
// (customer request — locations are predefined/obvious to staff).
const NAV_ITEMS: { to: string; label: string; end?: boolean; icon: ComponentType<{ size?: number }> }[] = [
  { to: '/', label: 'Dashboard / Operations Overview', end: true, icon: LayoutDashboard },
  { to: '/task-board', label: 'Task Board', icon: ClipboardList },
  { to: '/schedules', label: 'Attendance & Shift Roster', icon: CalendarClock },
  { to: '/reception-intake', label: 'Reception & Intake', icon: PackageSearch },
  { to: '/reception-reports', label: 'Reception Reports', icon: BarChart3 },
  { to: '/order-prep', label: 'Order Prep (Pick & Pack)', icon: ShoppingCart },
  { to: '/return-processing', label: 'Return Processing', icon: RotateCcw },
  { to: '/issue-queue', label: 'Exceptions & Issue Queue', icon: AlertTriangle },
  { to: '/reference-lists', label: 'User & Access Management', icon: Users },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell-outer">
      <TopHeader />
      <div className="app-shell">
        <aside className="sidebar">
          <nav>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">{user?.name}</div>
            <button className="btn btn-outline-accent" onClick={logout}>
              <LogOut size={14} />
              Log out
            </button>
          </div>
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
