import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiError } from '../core/api/client';
import { fetchSchedule, setSchedule, WEEKDAY_LABELS, WEEKDAYS, type Weekday } from '../core/api/schedules';
import { fetchStaffUsers } from '../core/api/users';
import { useAuth } from '../core/auth/AuthContext';

/**
 * Admin Conf doc: per-staff working days, shift hours, required daily
 * hours, and scheduled break start times. Purely a reminder/target
 * layer — see the backend's StaffSchedule doc comment — it doesn't
 * change how staff actually start/end their shift or breaks.
 */
export function SchedulesPage() {
  const { token } = useAuth();
  const { data: staff, isPending, error } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetchStaffUsers(token!),
    enabled: !!token,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      <h1>Staff Schedules</h1>
      <p className="page-subtitle">
        Set each staff member's working days, shift hours, required daily hours, and scheduled break times.
      </p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {staff && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 280px) 1fr', gap: 20, alignItems: 'start' }}>
          <div className="card">
            {staff.map((s) => (
              <button
                key={s.id}
                className="btn btn-outline"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 8,
                  color: '#0f172a',
                  borderColor: selectedId === s.id ? 'var(--brand-orange)' : '#d1d5db',
                }}
                onClick={() => setSelectedId(s.id)}
              >
                {s.name}
              </button>
            ))}
            {staff.length === 0 && <p className="hint-text">No staff accounts yet.</p>}
          </div>

          <div>
            {selectedId ? (
              <ScheduleEditor userId={selectedId} staffName={staff.find((s) => s.id === selectedId)?.name ?? ''} />
            ) : (
              <p className="hint-text">Select a staff member to view or edit their schedule.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleEditor({ userId, staffName }: { userId: string; staffName: string }) {
  const { token } = useAuth();
  const { data: schedule, isPending, error, refetch } = useQuery({
    queryKey: ['schedule', userId],
    queryFn: () => fetchSchedule(token!, userId),
    enabled: !!token,
  });

  const [workingDays, setWorkingDays] = useState<Weekday[]>([]);
  const [shiftStartTime, setShiftStartTime] = useState('07:30');
  const [shiftEndTime, setShiftEndTime] = useState('15:30');
  const [requiredWorkingHours, setRequiredWorkingHours] = useState(7);
  const [paidBreakStartTime, setPaidBreakStartTime] = useState('10:30');
  const [lunchBreakStartTime, setLunchBreakStartTime] = useState('12:30');
  const [lunchBreakDurationMinutes, setLunchBreakDurationMinutes] = useState(60);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load the existing schedule (if any) into the form whenever the
  // selected staff member changes or their data finishes loading.
  useEffect(() => {
    setSaved(false);
    setSaveError(null);
    if (schedule) {
      setWorkingDays(schedule.workingDays);
      setShiftStartTime(schedule.shiftStartTime);
      setShiftEndTime(schedule.shiftEndTime);
      setRequiredWorkingHours(schedule.requiredWorkingHours);
      setPaidBreakStartTime(schedule.paidBreakStartTime ?? '');
      setLunchBreakStartTime(schedule.lunchBreakStartTime ?? '');
      setLunchBreakDurationMinutes(schedule.lunchBreakDurationMinutes);
    } else if (schedule === null) {
      setWorkingDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
      setShiftStartTime('07:30');
      setShiftEndTime('15:30');
      setRequiredWorkingHours(7);
      setPaidBreakStartTime('10:30');
      setLunchBreakStartTime('12:30');
      setLunchBreakDurationMinutes(60);
    }
  }, [schedule, userId]);

  function toggleDay(day: Weekday) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

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
        paidBreakStartTime: paidBreakStartTime || undefined,
        lunchBreakStartTime: lunchBreakStartTime || undefined,
        lunchBreakDurationMinutes,
      });
      setSaved(true);
      refetch();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>{staffName}</h2>
      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      <div className="form-row">
        <label className="form-label">Working days</label>
        <div className="chip-row">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              className={`btn ${workingDays.includes(day) ? 'btn-primary' : 'btn-outline'}`}
              style={workingDays.includes(day) ? undefined : { color: '#0f172a', borderColor: '#d1d5db' }}
              onClick={() => toggleDay(day)}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">Shift start</label>
          <input type="time" value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} />
        </div>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">Shift end</label>
          <input type="time" value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} />
        </div>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">Required hours/day</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={requiredWorkingHours}
            onChange={(e) => setRequiredWorkingHours(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex-row" style={{ alignItems: 'flex-end' }}>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">Paid break at (20 min, fixed)</label>
          <input type="time" value={paidBreakStartTime} onChange={(e) => setPaidBreakStartTime(e.target.value)} />
        </div>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">Lunch break at</label>
          <input type="time" value={lunchBreakStartTime} onChange={(e) => setLunchBreakStartTime(e.target.value)} />
        </div>
        <div className="form-row" style={{ flex: 1 }}>
          <label className="form-label">Lunch duration (min)</label>
          <input
            type="number"
            min="1"
            value={lunchBreakDurationMinutes}
            onChange={(e) => setLunchBreakDurationMinutes(Number(e.target.value))}
          />
        </div>
      </div>

      {saveError && <p className="error-text">{saveError}</p>}
      {saved && <p className="hint-text" style={{ color: '#16a34a' }}>Saved.</p>}

      <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || workingDays.length === 0}>
        {isSaving ? 'Saving…' : 'Save schedule'}
      </button>
    </div>
  );
}
