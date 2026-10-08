import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentRouteStore } from '../../../core/navigation/currentRouteStore';
import { navigationRef } from '../../../core/navigation/navigationRef';
import { colors } from '../../../core/theme/colors';
import { useMyOpenFloorTask } from '../hooks/useFloorTasks';
import { CATEGORY_META } from '../types';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Small persistent popup, shown on every Staff screen except the one
 * task's own page, so a paused (or just-running) Floor Task is never
 * out of sight-out of mind while browsing the rest of the app. Tapping
 * it jumps straight back to that task's page.
 */
export function ActiveFloorTaskIndicator() {
  const insets = useSafeAreaInsets();
  const { data: openTask } = useMyOpenFloorTask();
  const routeName = useCurrentRouteStore((state) => state.routeName);

  const [now, setNow] = useState(() => Date.now());
  const isPaused = !!openTask?.pausedAt;
  useEffect(() => {
    if (!openTask || isPaused) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [openTask, isPaused]);

  // 'FloorTasks' is included because it now renders this same task's
  // page directly in place (see FloorTasksScreen) whenever one is open
  // — showing the popup there would be redundant too.
  if (!openTask || routeName === 'FloorTaskDetail' || routeName === 'FloorTasks') return null;

  const meta = CATEGORY_META.find((m) => m.category === openTask.category);
  const elapsedMs = now - new Date(openTask.startedAt).getTime() - openTask.totalPausedMs;

  return (
    <Pressable
      style={[styles.pill, { bottom: insets.bottom + 16 }]}
      onPress={() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate({ name: 'FloorTaskDetail', params: { category: openTask.category } } as never);
        }
      }}
    >
      <Text style={styles.label} numberOfLines={1}>
        {meta?.label ?? openTask.category}
      </Text>
      <Text style={isPaused ? styles.pausedStatus : styles.status}>
        {isPaused ? 'Paused' : formatElapsed(elapsedMs)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.brandOrange,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
    marginRight: 12,
  },
  status: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brandOrange,
  },
  pausedStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brandOrange,
  },
});
