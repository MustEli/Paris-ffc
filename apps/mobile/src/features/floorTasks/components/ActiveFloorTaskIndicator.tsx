import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActiveTaskGuardStore } from '../../../core/navigation/activeTaskGuardStore';
import { useCurrentRouteStore } from '../../../core/navigation/currentRouteStore';
import { navigationRef } from '../../../core/navigation/navigationRef';
import { colors } from '../../../core/theme/colors';
import { useMyOpenFloorTasks } from '../hooks/useFloorTasks';
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
 * task's own page, so a just-running Floor Task is never out of
 * sight-out of mind while browsing the rest of the app. Tapping it
 * jumps straight back to that task's page. Merely-paused tasks don't
 * show here — FloorTasksScreen's own parked-tasks list covers those —
 * this pill is specifically "something is live, ticking, right now."
 *
 * Also owns syncing the global isTaskRunning store (the Home icon's
 * leaving-guard) — this component is always mounted, unlike any one
 * task's own detail screen, so it stays correct even while that detail
 * screen (if open) is showing a *different*, merely-paused task of the
 * same staff member's.
 */
export function ActiveFloorTaskIndicator() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: openTasksData } = useMyOpenFloorTasks();
  const openTasks = openTasksData ?? [];
  const activeTask = openTasks.find((task) => !task.pausedAt);
  const routeName = useCurrentRouteStore((state) => state.routeName);

  // This component itself unmounts whenever the staff member goes on
  // break (see StaffAppShell) or off shift — the cleanup resets the
  // flag rather than leaving a stale `true` behind from just before
  // that happened (in practice a running task can't survive into a
  // break anyway, since starting one requires nothing be actively
  // running — but this stays correct regardless of that other rule).
  const setIsTaskRunning = useActiveTaskGuardStore((state) => state.setIsTaskRunning);
  useEffect(() => {
    setIsTaskRunning(!!activeTask);
    return () => setIsTaskRunning(false);
  }, [activeTask, setIsTaskRunning]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeTask) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTask]);

  // 'FloorTasks' is included because it now renders this same task's
  // page directly in place (see FloorTasksScreen) whenever one is open
  // — showing the popup there would be redundant too.
  if (!activeTask || routeName === 'FloorTaskDetail' || routeName === 'FloorTasks') return null;

  const meta = CATEGORY_META.find((m) => m.category === activeTask.category);
  const elapsedMs = now - new Date(activeTask.startedAt).getTime() - activeTask.totalPausedMs;

  return (
    <Pressable
      style={[styles.pill, { bottom: insets.bottom + 16 }]}
      onPress={() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate({ name: 'FloorTaskDetail', params: { category: activeTask.category } } as never);
        }
      }}
    >
      <Text style={styles.label} numberOfLines={1}>
        {meta ? t(meta.label) : activeTask.category}
      </Text>
      <Text style={styles.status}>{formatElapsed(elapsedMs)}</Text>
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
});
