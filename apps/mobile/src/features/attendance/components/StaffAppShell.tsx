import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { navigationRef } from '../../../core/navigation/navigationRef';
import { colors } from '../../../core/theme/colors';
import { ActiveFloorTaskIndicator } from '../../floorTasks/components/ActiveFloorTaskIndicator';
import { LUNCH_BREAK_SUGGESTED_DURATION_MS } from '../api';
import { useShiftStatus } from '../hooks/useShiftStatus';
import { ShiftStatusBar } from './ShiftStatusBar';
import { LockedGate } from '../../../core/components/LockedGate';

/** "MM:SS", counting down; past zero it flips to "+MM:SS" (over), rather than going negative. */
function formatCountdown(ms: number): string {
  const over = ms < 0;
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const digits = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  return over ? `+${digits}` : digits;
}

/**
 * Wraps the whole Staff stack. The off-shift and on-break states both
 * get the identical treatment: the real screen underneath keeps
 * rendering (so it's genuinely "faded back layer", not swapped out),
 * with a LockedGate overlaid on top blocking interaction — scoped to
 * the content area only, below ShiftStatusBar, so its dropdown (End
 * Break / End Shift) stays reachable during a break. Off-shift shows
 * no status bar at all (there's no shift to report on yet), so its
 * gate covers the full screen instead.
 */
export function StaffAppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const logout = useAuthStore((state) => state.logout);
  const { status, statusUpdatedAt, isLoadingStatus, start, isStarting, endBreak, isEndingBreak } = useShiftStatus();

  // While status is still loading, don't flash a gate that's about to
  // disappear — treat as on-shift briefly rather than a misleading
  // lock-then-unlock blink (same reasoning the old disabled-cards menu
  // used).
  const onShift = isLoadingStatus || !!status?.active;
  const onBreak = !isLoadingStatus && !!status?.onBreak;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!onBreak) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [onBreak]);

  // Short break ticks down from whatever the last status fetch reported
  // (that poll already accounts for usage across earlier short breaks
  // this shift), offset by real time elapsed since that fetch so it
  // doesn't just jump every 5s. Lunch has no running total to carry —
  // it's a plain countdown from this one break's own start time.
  const breakCounter =
    status?.breakType === 'short'
      ? formatCountdown(status.shortBreakRemainingMs - (now - statusUpdatedAt))
      : status?.breakType === 'lunch' && status.breakStartedAt
        ? formatCountdown(LUNCH_BREAK_SUGGESTED_DURATION_MS - (now - new Date(status.breakStartedAt).getTime()))
        : undefined;

  function handleStartShift() {
    start(undefined, {
      onSuccess: () => {
        const user = useAuthStore.getState().user;
        if (!user?.photoUrl && navigationRef.isReady()) {
          navigationRef.navigate('SelfieCapture' as never);
        }
      },
    });
  }

  return (
    <View style={styles.container}>
      {onShift && !isLoadingStatus && <ShiftStatusBar />}
      <View style={styles.content}>
        {children}

        {!isLoadingStatus && !onShift && (
          <LockedGate
            title={t('shiftGate.readyTitle')}
            subtitle={t('shiftGate.readySubtitle')}
            buttonLabel={t('shiftGate.startShift')}
            onPress={handleStartShift}
            isBusy={isStarting}
            secondaryLabel={t('shiftGate.logOut')}
            onSecondaryPress={logout}
          />
        )}

        {!isLoadingStatus && onShift && onBreak && (
          <LockedGate
            counter={breakCounter}
            title={status?.breakType === 'lunch' ? t('shiftGate.onLunchBreak') : t('shiftGate.onShortBreak')}
            subtitle={t('shiftGate.onBreakSubtitle')}
            buttonLabel={t('shiftGate.endBreak')}
            onPress={() => endBreak()}
            isBusy={isEndingBreak}
          />
        )}

        {onShift && !onBreak && !isLoadingStatus && <ActiveFloorTaskIndicator />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
