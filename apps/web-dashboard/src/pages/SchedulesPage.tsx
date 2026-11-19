import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarClock, Save, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../core/api/client';
import { fetchAttendanceReport } from '../core/api/reports';
import { fetchSchedule, setSchedule, WEEKDAYS, type Weekday } from '../core/api/schedules';
import { fetchStaffUsers } from '../core/api/users';
import { useAuth } from '../core/auth/AuthContext';

/** "HH:MM" -> minutes since midnight. */
function parseHHMM(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes since midnight -> "HH:MM", wrapping past midnight (e.g. a late shift start + a long total time). */
function formatHHMM(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** e.g. 480 -> "8h 0m". */
function formatDurationMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

/**
 * Admin Conf doc: per-staff working days, shift hours, required daily
 * hours, and scheduled break start times. Purely a reminder/target
 * layer — see the backend's StaffSchedule doc comment — it doesn't
 * change how staff actually start/end their shift or breaks.
 */
export function SchedulesPage() {
  const { t } = useTranslation('schedules');
  const { token } = useAuth();
  const { data: staff, isPending, error } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetchStaffUsers(token!),
    enabled: !!token,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      <div className="page-header-row">
        <span className="icon-badge icon-badge-blue">
          <CalendarClock />
        </span>
        <div className="page-header-text">
          <h1>{t('title')}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {t('subtitle')}
          </p>
        </div>
      </div>

      {isPending && <p>{t('loading')}</p>}
      {error && <p className="error-text">{error.message}</p>}

      <AttendanceTotalsTable />

      {staff && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 280px) 1fr', gap: 20, alignItems: 'start' }}>
          <div className="card">
            {staff.map((s) => (
              <button
                key={s.id}
                className={`btn ${selectedId === s.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ justifyContent: 'flex-start', width: '100%', marginBottom: 8 }}
                onClick={() => setSelectedId(s.id)}
              >
                <span
                  className="top-header-avatar"
                  style={{
                    width: 26,
                    height: 26,
                    fontSize: 11,
                    background: selectedId === s.id ? 'rgba(255,255,255,0.25)' : 'var(--brand-orange)',
                  }}
                >
                  {s.name.charAt(0).toUpperCase()}
                </span>
                {s.name}
              </button>
            ))}
            {staff.length === 0 && <p className="hint-text">{t('noStaffAccounts')}</p>}
          </div>

          <div>
            {selectedId ? (
              <ScheduleEditor userId={selectedId} staffName={staff.find((s) => s.id === selectedId)?.name ?? ''} />
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <span
                  className="icon-badge icon-badge-gray"
                  style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)', margin: '0 auto 14px' }}
                >
                  <UserRound size={26} />
                </span>
                <p className="hint-text">{t('selectStaffPrompt')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Actual worked totals (completed shifts only, lunch time excluded) — distinct from the schedule editor below it, which only sets the *target* days/hours. See ReportsService.attendance() for how these are computed. */
function AttendanceTotalsTable() {
  const { t } = useTranslation('schedules');
  const { token } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: ['attendance-report'],
    queryFn: () => fetchAttendanceReport(token!),
    enabled: !!token,
  });

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="flex-row" style={{ marginBottom: 12 }}>
        <span className="icon-badge icon-badge-sm icon-badge-purple">
          <BarChart3 />
        </span>
        <h2 style={{ margin: 0 }}>{t('attendanceTotals.heading')}</h2>
      </div>
      {isPending && <p>{t('loading')}</p>}
      {error && <p className="error-text">{error.message}</p>}
      {data && (
        <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('attendanceTotals.staff')}</th>
              <th>{t('attendanceTotals.totalShiftDays')}</th>
              <th>{t('attendanceTotals.totalHoursWorked')}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.userId}>
                <td className="staff-name-cell">{row.userName}</td>
                <td>{row.totalShifts}</td>
                <td>{row.totalHoursWorked}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {data && data.rows.length === 0 && <p className="hint-text">{t('attendanceTotals.noCompletedShifts')}</p>}
    </div>
  );
}

function ScheduleEditor({ userId, staffName }: { userId: string; staffName: string }) {
  const { t } = useTranslation('schedules');
  const { token } = useAuth();
  const { data: schedule, isPending, error, refetch } = useQuery({
    queryKey: ['schedule', userId],
    queryFn: () => fetchSchedule(token!, userId),
    enabled: !!token,
  });

  const [workingDays, setWorkingDays] = useState<Weekday[]>([]);
  const [shiftStartTime, setShiftStartTime] = useState('07:30');
  const [requiredWorkingHours, setRequiredWorkingHours] = useState(7);
  const [lunchBreakDurationMinutes, setLunchBreakDurationMinutes] = useState(60);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load the existing schedule (if any) into the form whenever the
  // selected staff member changes or their data finishes loading.
  // Shift end is no longer part of the form's own state — see
  // totalMinutes/shiftEndTime below, computed fresh on every render.
  useEffect(() => {
    setSaved(false);
    setSaveError(null);
    if (schedule) {
      setWorkingDays(schedule.workingDays);
      setShiftStartTime(schedule.shiftStartTime);
      setRequiredWorkingHours(schedule.requiredWorkingHours);
      setLunchBreakDurationMinutes(schedule.lunchBreakDurationMinutes);
    } else if (schedule === null) {
      setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
      setShiftStartTime('07:30');
      setRequiredWorkingHours(7);
      setLunchBreakDurationMinutes(60);
    }
  }, [schedule, userId]);

  function toggleDay(day: Weekday) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  // Total time = required working hours + lunch duration (paid break is
  // already inside required hours — it's paid, not subtracted from
  // worked time — so it doesn't add extra span on top). Shift end is
  // shift start + that total, so it's never typed in directly.
  const totalMinutes = Math.round(requiredWorkingHours * 60) + lunchBreakDurationMinutes;
  const shiftEndTime = formatHHMM(parseHHMM(shiftStartTime) + totalMinutes);

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await setSchedule(token!, userId, {
        workingDays,
        shiftStartTime,
        shiftEndTime,
        requiredWorkingHours,
        lunchBreakDurationMinutes,
      });
      setSaved(true);
      refetch();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t('editor.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="flex-row" style={{ marginBottom: 16 }}>
        <span className="top-header-avatar" style={{ width: 36, height: 36, fontSize: 15, background: 'var(--brand-orange)' }}>
          {staffName.charAt(0).toUpperCase()}
        </span>
        <h2 style={{ margin: 0 }}>{staffName}</h2>
      </div>
      {isPending && <p>{t('loading')}</p>}
      {error && <p className="error-text">{error.message}</p>}

      <div className="form-row">
        <label className="form-label">{t('editor.workingDays')}</label>
        <div className="chip-row">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              className={`btn ${workingDays.includes(day) ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => toggleDay(day)}
            >
              {t(`weekdays.${day}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">{t('editor.shiftStart')}</label>
          <input type="time" value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} />
        </div>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">{t('editor.requiredHoursPerDay')}</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={requiredWorkingHours}
            onChange={(e) => setRequiredWorkingHours(Number(e.target.value))}
          />
        </div>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">{t('editor.lunchBreakDurationMin')}</label>
          <input
            type="number"
            min="1"
            value={lunchBreakDurationMinutes}
            onChange={(e) => setLunchBreakDurationMinutes(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">{t('editor.totalTime')}</label>
          <input type="text" value={formatDurationMinutes(totalMinutes)} disabled />
        </div>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">{t('editor.shiftEndCalculated')}</label>
          <input type="time" value={shiftEndTime} disabled />
        </div>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">{t('editor.paidBreakDuration')}</label>
          <input type="text" value={t('editor.paidBreakFixed')} disabled />
        </div>
      </div>

      {saveError && <p className="error-text">{saveError}</p>}
      {saved && <p className="hint-text" style={{ color: '#16a34a' }}>{t('editor.saved')}</p>}

      <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || workingDays.length === 0}>
        <Save size={14} />
        {isSaving ? t('editor.saving') : t('editor.saveSchedule')}
      </button>
    </div>
  );
}
