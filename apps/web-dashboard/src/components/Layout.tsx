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
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../core/auth/AuthContext';
import { TopHeader } from './TopHeader';

// Labels/order follow the customer's requested sidebar spec, with
// "Task Board" kept as-is (it wasn't in that spec, but has no other
// home). Order Prep/Return Processing/Issue Queue link to
// PlaceholderPage.tsx's "coming soon" pages — nothing is built for
// them yet. "Put-Away & Location Assignment" was removed entirely
// (customer request — locations are predefined/obvious to staff).
const NAV_ITEMS: { to: string; labelKey: string; end?: boolean; icon: ComponentType<{ size?: number }> }[] = [
  { to: '/', labelKey: 'nav.dashboard', end: true, icon: LayoutDashboard },
  { to: '/task-board', labelKey: 'nav.taskBoard', icon: ClipboardList },
  { to: '/schedules', labelKey: 'nav.schedules', icon: CalendarClock },
  { to: '/reception-intake', labelKey: 'nav.receptionIntake', icon: PackageSearch },
  { to: '/reception-reports', labelKey: 'nav.receptionReports', icon: BarChart3 },
  { to: '/order-prep', labelKey: 'nav.orderPrep', icon: ShoppingCart },
  { to: '/return-processing', labelKey: 'nav.returnProcessing', icon: RotateCcw },
  { to: '/issue-queue', labelKey: 'nav.issueQueue', icon: AlertTriangle },
  { to: '/reference-lists', labelKey: 'nav.referenceLists', icon: Users },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
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
                  {t(item.labelKey)}
                </NavLink>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">{user?.name}</div>
            <button className="btn btn-outline-accent" onClick={logout}>
              <LogOut size={14} />
              {t('logOut')}
            </button>
          </div>
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
