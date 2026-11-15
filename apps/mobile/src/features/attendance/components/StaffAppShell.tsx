import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { navigationRef } from '../../../core/navigation/navigationRef';
import { colors } from '../../../core/theme/colors';
import { ActiveFloorTaskIndicator } from '../../floorTasks/components/ActiveFloorTaskIndicator';
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

  // `now` only needs to tick once a second while a break is running
  // (see the interval below) — the rest of the time it's fine for it to
  // sit stale, since nothing reads it. But that staleness is exactly
  // the bug: the instant `onBreak` flips false -> true, `now` still
  // holds whatever old timestamp it last had (the previous break's
  // final tick, or this component's mount time if this is the first
  // break of the session) — possibly minutes or hours old — while
  // `statusUpdatedAt` has just jumped to "right now" (the status
  // refetch that followed the break actually starting). The breakCounter
  // math below subtracts a stale, too-small `now - statusUpdatedAt`,
  // which inflates the very first displayed countdown by however long
  // `now` had gone un-refreshed (the "60:05"/"20:01" instead of an
  // exact "60:00"/"20:00" the admin reported). Resetting `now`
  // synchronously here — during render, the instant the transition is
  // seen, via the officially-supported "adjust state while rendering"
  // pattern — fixes this before the first paint, rather than waiting
  // for the interval's first 1s tick to correct it a moment later.
  const wasOnBreakRef = useRef(onBreak);
  if (onBreak && !wasOnBreakRef.current) {
    setNow(Date.now());
  }
  wasOnBreakRef.current = onBreak;

  useEffect(() => {
    if (!onBreak) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [onBreak]);

  // Both break types tick down from whatever the last status fetch
  // reported — that poll already accounts for usage across earlier
  // breaks of the same type this shift (ending one and starting another
  // later continues from the remaining time, it doesn't reset) — offset
  // by real time elapsed since that fetch so it doesn't just jump on
  // every poll.
  const breakCounter =
    status?.breakType === 'short'
      ? formatCountdown(status.shortBreakRemainingMs - (now - statusUpdatedAt))
      : status?.breakType === 'lunch' && status.lunchBreakRemainingMs !== null
        ? formatCountdown(status.lunchBreakRemainingMs - (now - statusUpdatedAt))
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
