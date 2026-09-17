import { useQuery } from '@tanstack/react-query';

import { fetchAdminDashboard, type AdminDashboardReport } from '../core/api/reports';
import { useAuth } from '../core/auth/AuthContext';

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** `ms` may be negative for lunch (no real cap — see LUNCH_BREAK_SUGGESTED_DURATION_MS on the backend). */
function formatMinutesSeconds(ms: number): string {
  const totalSeconds = Math.round(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function breakLabel(staff: AdminDashboardReport['staff'][number]): string {
  if (staff.breakType === 'short') {
    const remaining = staff.shortBreakRemainingMs ?? 0;
    return `Short break — ${formatMinutesSeconds(Math.max(0, remaining))} remaining`;
  }
  if (staff.breakType === 'lunch') {
    const remaining = staff.lunchBreakRemainingMs ?? 0;
    return `Lunch break — ${formatMinutesSeconds(remaining)} ${remaining >= 0 ? 'remaining' : 'over'}`;
  }
  return 'On break';
}

/**
 * Same underlying GET /reports/admin-dashboard the mobile Admin
 * dashboard uses — this is the one screen in this app that's
 * deliberately a rough mirror of mobile, since "what's happening right
 * now" is exactly as useful from a desk as from a phone. Everything
 * else in this app (reference lists, bulk instructions, bulk photo
 * download) has no mobile equivalent at all.
 */
export function DashboardPage() {
  const { token } = useAuth();
  const { data, isPending, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => fetchAdminDashboard(token!),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="page-subtitle">{today}</p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {data && (
        <>
          <div className="section-toolbar">
            <h2 style={{ margin: 0 }}>Current status</h2>
            <button className="btn btn-outline" style={{ color: '#0f172a', borderColor: '#d1d5db' }} onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <div className="stat-tile-label">Staff on shift</div>
                <div className="stat-tile-value">
                  {data.liveSummary.staffOnShiftCount} / {data.liveSummary.totalStaffCount}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Pallets pending review</div>
                <div className="stat-tile-value">{data.liveSummary.palletsPendingReviewCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Open put-away tasks</div>
                <div className="stat-tile-value">{data.liveSummary.openPutAwayTaskCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Active order-prep sessions</div>
                <div className="stat-tile-value">{data.liveSummary.activeOrderPrepSessionCount}</div>
              </div>
            </div>
          </div>

          <h2>Today</h2>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <div className="stat-tile-label">Receptions logged</div>
                <div className="stat-tile-value">{data.today.receptionsLoggedCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Receptions completed</div>
                <div className="stat-tile-value">{data.today.receptionsCompletedCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Pallets logged</div>
                <div className="stat-tile-value">{data.today.palletsLoggedCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Put-away completed</div>
                <div className="stat-tile-value">{data.today.putAwayCompletedCount}</div>
              </div>
            </div>
          </div>

          <h2>Staff</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Shifts today</th>
                  <th>Hours worked today</th>
                  <th>Put-away done</th>
                  <th>Order prep done</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.length === 0 && (
                  <tr>
                    <td colSpan={6}>No staff accounts yet.</td>
                  </tr>
                )}
                {data.staff.map((s) => (
                  <tr key={s.userId}>
                    <td>{s.userName}</td>
                    <td>
                      {s.onShift ? (
                        <span className="pill pill-green">
                          On shift{s.shiftStartedAt ? ` since ${formatLocalTime(s.shiftStartedAt)}` : ''}
                        </span>
                      ) : (
                        <span className="pill pill-gray">Off shift</span>
                      )}
                      {s.onBreak && (
                        <span className="pill pill-amber" style={{ marginLeft: 6 }}>
                          {breakLabel(s)}
                        </span>
                      )}
                    </td>
                    <td>{s.shiftsToday}</td>
                    <td>{s.hoursWorkedToday}</td>
                    <td>{s.putAwayCompletedToday}</td>
                    <td>{s.orderPrepCompletedToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
