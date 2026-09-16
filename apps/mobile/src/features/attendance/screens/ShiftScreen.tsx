import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { useShiftStatus } from '../hooks/useShiftStatus';

function formatLocalTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatMinutesSeconds(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Feature 1 (Shift Attendance) MVP from the requirements doc: a single
 * button that toggles Start Shift / End Shift, backed by
 * POST /shifts/start and /shifts/end. Also covers the doc's "Automated
 * Break Management" future-dev section, scoped down to two
 * staff-initiated break types (no admin-scheduled windows/reminders
 * yet): an unpaid Lunch Break (excluded from worked-hours totals) and a
 * paid Short Break capped at 20 cumulative minutes per shift (not
 * excluded — it's paid time). Only one break of either type can be open
 * at once. The 7-hour-completion notification logic from the doc is
 * still push-notification territory, deliberately not here yet.
 */
export function ShiftScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const {
    status,
    isLoadingStatus,
    statusError,
    start,
    isStarting,
    startError,
    end,
    isEnding,
    endError,
    startBreak,
    isStartingBreak,
    startBreakError,
    endBreak,
    isEndingBreak,
    endBreakError,
  } = useShiftStatus();

  const isBusy = isStarting || isEnding;
  const isBreakBusy = isStartingBreak || isEndingBreak;
  const actionError = startError ?? endError ?? startBreakError ?? endBreakError ?? statusError;

  const onShortBreak = !!status?.onBreak && status.breakType === 'short';
  const onLunchBreak = !!status?.onBreak && status.breakType === 'lunch';

  // Ticks every second so the short-break countdown moves smoothly
  // between the ~5s server polls (see useShiftStatus's refetchInterval)
  // rather than jumping once every poll.
  const [displayRemainingMs, setDisplayRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    setDisplayRemainingMs(onShortBreak ? (status?.shortBreakRemainingMs ?? 0) : null);
  }, [onShortBreak, status?.shortBreakRemainingMs]);
  useEffect(() => {
    if (displayRemainingMs === null) return;
    const interval = setInterval(() => {
      setDisplayRemainingMs((prev) => (prev !== null ? Math.max(0, prev - 1000) : null));
    }, 1000);
    return () => clearInterval(interval);
    // Intentionally only restarts when we start/stop counting down, not
    // on every tick of the value itself — see the effect above for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayRemainingMs === null]);

  // The actual cutoff is enforced by the server-reported value (fresh
  // every ~5s while on a short break) — this just acts on it the moment
  // it's seen, while the app is open. See docs/architecture.md for why
  // this can't be instant if the app gets closed mid-break instead.
  useEffect(() => {
    if (onShortBreak && (status?.shortBreakRemainingMs ?? 0) <= 0 && !isEndingBreak) {
      endBreak();
    }
  }, [onShortBreak, status?.shortBreakRemainingMs, isEndingBreak, endBreak]);

  const shortBreakAvailable = (status?.shortBreakRemainingMs ?? 0) > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Staff — {user?.name}</Text>
      <Text style={styles.title}>Shift Attendance</Text>

      {isLoadingStatus ? (
        <ActivityIndicator style={styles.statusSpinner} />
      ) : (
        <>
          <Text style={styles.status}>
            {status?.active && status.startedAt
              ? `On shift since ${formatLocalTime(status.startedAt)}`
              : 'Not currently on shift'}
          </Text>
          {onLunchBreak && status?.breakStartedAt && (
            <Text style={styles.breakStatus}>On lunch break since {formatLocalTime(status.breakStartedAt)}</Text>
          )}
          {onShortBreak && (
            <Text style={styles.breakStatus}>
              On short break — {formatMinutesSeconds(displayRemainingMs ?? 0)} remaining
            </Text>
          )}
        </>
      )}

      {actionError && <Text style={styles.error}>{actionError.message}</Text>}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          status?.active ? styles.buttonEnd : styles.buttonStart,
          (pressed || isBusy || isLoadingStatus) && styles.buttonPressed,
        ]}
        onPress={() => (status?.active ? end() : start())}
        disabled={isBusy || isLoadingStatus}
      >
        {isBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{status?.active ? 'End Shift' : 'Start Shift'}</Text>
        )}
      </Pressable>

      {status?.active && (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.breakButton,
              (pressed || isBreakBusy || isLoadingStatus || onShortBreak) && styles.buttonPressed,
              onShortBreak && styles.buttonDisabled,
            ]}
            onPress={() => (onLunchBreak ? endBreak() : startBreak('lunch'))}
            disabled={isBreakBusy || isLoadingStatus || onShortBreak}
          >
            {isBreakBusy && onLunchBreak ? (
              <ActivityIndicator color="#b45309" />
            ) : (
              <Text style={styles.breakButtonText}>{onLunchBreak ? 'End Lunch Break' : 'Start Lunch Break'}</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.breakButton,
              (pressed || isBreakBusy || isLoadingStatus || onLunchBreak || (!onShortBreak && !shortBreakAvailable)) &&
                styles.buttonPressed,
              (onLunchBreak || (!onShortBreak && !shortBreakAvailable)) && styles.buttonDisabled,
            ]}
            onPress={() => (onShortBreak ? endBreak() : startBreak('short'))}
            disabled={isBreakBusy || isLoadingStatus || onLunchBreak || (!onShortBreak && !shortBreakAvailable)}
          >
            {isBreakBusy && onShortBreak ? (
              <ActivityIndicator color="#b45309" />
            ) : (
              <Text style={styles.breakButtonText}>
                {onShortBreak
                  ? 'End Short Break'
                  : shortBreakAvailable
                    ? 'Start Short Break'
                    : 'Short Break Used Up'}
              </Text>
            )}
          </Pressable>
        </>
      )}

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
  },
  statusSpinner: {
    marginBottom: 24,
  },
  status: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
  },
  breakStatus: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonStart: {
    backgroundColor: '#16a34a',
  },
  buttonEnd: {
    backgroundColor: '#dc2626',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  breakButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  breakButtonText: {
    color: '#b45309',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 32,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  logoutText: {
    color: '#0f172a',
    fontWeight: '600',
  },
});
