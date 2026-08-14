import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { useShiftStatus } from '../hooks/useShiftStatus';

function formatLocalTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Feature 1 (Shift Attendance) MVP from the requirements doc: a single
 * button that toggles Start Shift / End Shift, backed by
 * POST /shifts/start and /shifts/end. The 7-hour-completion notification
 * logic from the doc is push-notification territory (roadmap step 5) —
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
  } = useShiftStatus();

  const isBusy = isStarting || isEnding;
  const actionError = startError ?? endError ?? statusError;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Staff — {user?.name}</Text>
      <Text style={styles.title}>Shift Attendance</Text>

      {isLoadingStatus ? (
        <ActivityIndicator style={styles.statusSpinner} />
      ) : (
        <Text style={styles.status}>
          {status?.active && status.startedAt
            ? `On shift since ${formatLocalTime(status.startedAt)}`
            : 'Not currently on shift'}
        </Text>
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
    marginBottom: 24,
    textAlign: 'center',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
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
