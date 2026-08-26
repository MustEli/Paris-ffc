import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { useShiftStatus } from '../hooks/useShiftStatus';

function formatLocalTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Feature 1 (Shift Attendance) MVP from the requirements doc: a single
 * button that toggles Start Shift / End Shift, backed by
 * POST /shifts/start and /shifts/end. Also covers the doc's "Automated
 * Break Management" future-dev section, scoped down to a staff-initiated
 * lunch break (no admin-scheduled windows/reminders yet) — going to
 * lunch no longer means stopping the whole shift. The 7-hour-completion
 * notification logic from the doc is still push-notification territory,
 * deliberately not here yet.
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
    startLunchBreak,
    isStartingBreak,
    startBreakError,
    endLunchBreak,
    isEndingBreak,
    endBreakError,
  } = useShiftStatus();

  const isBusy = isStarting || isEnding;
  const isBreakBusy = isStartingBreak || isEndingBreak;
  const actionError = startError ?? endError ?? startBreakError ?? endBreakError ?? statusError;

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
          {status?.onBreak && status.breakStartedAt && (
            <Text style={styles.breakStatus}>On lunch break since {formatLocalTime(status.breakStartedAt)}</Text>
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
        <Pressable
          style={({ pressed }) => [
            styles.breakButton,
            (pressed || isBreakBusy || isLoadingStatus) && styles.buttonPressed,
          ]}
          onPress={() => (status.onBreak ? endLunchBreak() : startLunchBreak())}
          disabled={isBreakBusy || isLoadingStatus}
        >
          {isBreakBusy ? (
            <ActivityIndicator color="#b45309" />
          ) : (
            <Text style={styles.breakButtonText}>
              {status.onBreak ? 'End Lunch Break' : 'Start Lunch Break'}
            </Text>
          )}
        </Pressable>
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
