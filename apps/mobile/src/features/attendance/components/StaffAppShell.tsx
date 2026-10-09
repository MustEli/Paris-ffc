import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { navigationRef } from '../../../core/navigation/navigationRef';
import { colors } from '../../../core/theme/colors';
import { ActiveFloorTaskIndicator } from '../../floorTasks/components/ActiveFloorTaskIndicator';
import { useShiftStatus } from '../hooks/useShiftStatus';
import { ShiftStatusBar } from './ShiftStatusBar';
import { LockedGate } from '../../../core/components/LockedGate';

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
  const { status, isLoadingStatus, start, isStarting, endBreak, isEndingBreak } = useShiftStatus();

  // While status is still loading, don't flash a gate that's about to
  // disappear — treat as on-shift briefly rather than a misleading
  // lock-then-unlock blink (same reasoning the old disabled-cards menu
  // used).
  const onShift = isLoadingStatus || !!status?.active;
  const onBreak = !isLoadingStatus && !!status?.onBreak;

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
