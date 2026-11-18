import { useFocusEffect, type RouteProp } from '@react-navigation/native';
import { ArrowLeftRight, CheckCheck, Play } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { useStaffUsers } from '../../../core/hooks/useStaffUsers';
import { useActiveTaskContextStore } from '../../../core/navigation/activeTaskContextStore';
import { goToStaffHome } from '../../../core/navigation/navigationRef';
import { colors } from '../../../core/theme/colors';
import { type PutAwayStackParamList } from '../../../navigation/types';
import { RaisedIssuesList } from '../../issueReports/components/RaisedIssuesList';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../tasks/priority';
import { useCompleteTask, useReassignTask, useStartTask, useTask } from '../hooks/usePutAwayTasks';
import { STATUS_LABELS } from '../types';

interface Props {
  route: RouteProp<PutAwayStackParamList, 'PutAwayTaskDetail'>;
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * Doc Feature 4 Execution & Branching: Start → Complete (Branch A) or
 * Report Issue (Branch B) → Admin reassigns. Reporting an issue is now
 * the same global QuickIssueButton every other task screen uses (see
 * activeTaskContextStore) rather than a bespoke inline form — it no
 * longer flips this task's own status to "issue_reported" or drives
 * the reassign branch below; an existing row already in that status
 * (from before this change) still shows the reassign UI, but no new
 * report can land there going forward.
 */
export function PutAwayTaskDetailScreen({ route }: Props) {
  const { id } = route.params;
  const role = useAuthStore((state) => state.user?.role);
  const { data: task, isPending, error } = useTask(id);
  const [reassignTo, setReassignTo] = useState<string | null>(null);

  const start = useStartTask(id);
  const complete = useCompleteTask(id);
  const reassign = useReassignTask(id);
  const { data: staffUsers } = useStaffUsers();

  const isStaffDark = role === 'staff';
  const styles = getStyles(isStaffDark);

  const setLabel = useActiveTaskContextStore((s) => s.setLabel);
  useFocusEffect(
    useCallback(() => {
      if (task?.status === 'assigned' || task?.status === 'in_progress') setLabel('Put-Away Task', `put_away:${task.id}`);
      return () => setLabel(null);
    }, [task?.status, task?.id, setLabel]),
  );

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error || !task) {
    return <Text style={styles.error}>{error?.message ?? 'Not found'}</Text>;
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.location}>{task.location}</Text>
        <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[task.priority] }]}>
          <Text style={styles.priorityText}>{PRIORITY_LABELS[task.priority]}</Text>
        </View>
      </View>
      <Text style={styles.status}>{STATUS_LABELS[task.status]}</Text>
      <Text style={styles.meta}>Assigned: {new Date(task.assignedAt).toLocaleString()}</Text>
      {task.startedAt && <Text style={styles.meta}>Started: {new Date(task.startedAt).toLocaleString()}</Text>}
      {task.durationMs !== null && <Text style={styles.meta}>Took {formatDuration(task.durationMs)}</Text>}

      {task.instructions && (
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsLabel}>Instructions</Text>
          <Text style={styles.instructionsText}>{task.instructions}</Text>
        </View>
      )}

      {task.issueDescription && (
        <View style={styles.issueBox}>
          <Text style={styles.issueLabel}>Reported issue</Text>
          <Text style={styles.issueText}>{task.issueDescription}</Text>
        </View>
      )}

      {role === 'staff' && task.status === 'assigned' && (
        <View style={styles.actionBox}>
          {start.error && <Text style={styles.error}>{start.error.message}</Text>}
          <Pressable style={styles.button} disabled={start.isPending} onPress={() => start.mutate()}>
            {start.isPending ? (
              <ActivityIndicator color={isStaffDark ? '#1a1200' : '#fff'} />
            ) : (
              <>
                <Play size={16} color={isStaffDark ? '#1a1200' : '#fff'} style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Start task</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {role === 'staff' && task.status === 'in_progress' && (
        <View style={styles.actionBox}>
          {complete.error && <Text style={styles.error}>{complete.error.message}</Text>}
          <Pressable
            style={styles.button}
            disabled={complete.isPending}
            onPress={() => complete.mutate(undefined, { onSuccess: goToStaffHome })}
          >
            {complete.isPending ? (
              <ActivityIndicator color={isStaffDark ? '#1a1200' : '#fff'} />
            ) : (
              <>
                <CheckCheck size={16} color={isStaffDark ? '#1a1200' : '#fff'} style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Task completed</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {role === 'admin' && task.status === 'issue_reported' && (
        <View style={styles.actionBox}>
          <Text style={styles.label}>Reassign to</Text>
          <View style={styles.staffList}>
            {staffUsers?.map((user) => (
              <Pressable
                key={user.id}
                style={[styles.staffChip, reassignTo === user.id && styles.staffChipSelected]}
                onPress={() => setReassignTo(user.id)}
              >
                <Text style={[styles.staffChipText, reassignTo === user.id && styles.staffChipTextSelected]}>
                  {user.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {reassign.error && <Text style={styles.error}>{reassign.error.message}</Text>}
          <Pressable
            style={[styles.button, !reassignTo && styles.buttonDisabled]}
            disabled={!reassignTo || reassign.isPending}
            onPress={() => reassignTo && reassign.mutate({ assignedToUserId: reassignTo })}
          >
            {reassign.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ArrowLeftRight size={16} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Reassign task</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      <RaisedIssuesList taskRef={`put_away:${task.id}`} />
    </KeyboardAwareScreen>
  );
}

/**
 * Shared between Staff (dark theme) and Admin/Management (existing
 * light theme — deliberately unchanged, see colors.ts) — this screen
 * never set an explicit container background, so it silently inherited
 * whatever the navigator behind it painted. That's correct for
 * Admin/Management (light navigator) but broke for Staff once the app
 * went dark everywhere else: light-theme text/borders on a dark page.
 * Recomputed per render from `role` rather than a static StyleSheet so
 * both appearances stay intentional instead of one being an accident.
 */
function getStyles(isStaffDark: boolean) {
  return StyleSheet.create({
    container: {
      padding: 20,
      ...(isStaffDark ? { backgroundColor: colors.background } : null),
    },
    spinner: {
      marginTop: 40,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    location: {
      fontSize: 20,
      fontWeight: '700',
      color: isStaffDark ? colors.textPrimary : '#0f172a',
    },
    priorityPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    priorityText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '600',
    },
    instructionsBox: {
      marginTop: 14,
      padding: 14,
      borderRadius: 10,
      backgroundColor: isStaffDark ? colors.surfaceElevated : '#f1f5f9',
    },
    instructionsLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: isStaffDark ? colors.textSecondary : '#334155',
      marginBottom: 4,
    },
    instructionsText: {
      fontSize: 14,
      color: isStaffDark ? colors.textPrimary : '#1e293b',
    },
    status: {
      fontSize: 13,
      fontWeight: '600',
      color: '#2563eb',
      marginTop: 4,
      marginBottom: 10,
    },
    meta: {
      fontSize: 12,
      color: isStaffDark ? colors.textMuted : '#9ca3af',
      marginTop: 2,
    },
    issueBox: {
      marginTop: 16,
      padding: 14,
      borderRadius: 10,
      backgroundColor: isStaffDark ? colors.alertSurface : '#fef2f2',
    },
    issueLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: isStaffDark ? colors.alert : '#b91c1c',
      marginBottom: 4,
    },
    issueText: {
      fontSize: 14,
      color: isStaffDark ? colors.textSecondary : '#7f1d1d',
    },
    actionBox: {
      marginTop: 28,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: isStaffDark ? colors.textSecondary : '#374151',
      marginBottom: 6,
    },
    staffList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    staffChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isStaffDark ? colors.border : '#d1d5db',
    },
    staffChipSelected: {
      backgroundColor: isStaffDark ? colors.brandOrange : '#0f172a',
      borderColor: isStaffDark ? colors.brandOrange : '#0f172a',
    },
    staffChipText: {
      fontSize: 13,
      color: isStaffDark ? colors.textSecondary : '#374151',
    },
    staffChipTextSelected: {
      color: isStaffDark ? '#1a1200' : '#fff',
      fontWeight: '600',
    },
    button: {
      flexDirection: 'row',
      backgroundColor: isStaffDark ? colors.brandOrange : '#0f172a',
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonIcon: {
      marginRight: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: isStaffDark ? '#1a1200' : '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    error: {
      color: isStaffDark ? colors.alert : '#dc2626',
      fontSize: 13,
      marginTop: 8,
      marginBottom: 8,
    },
  });
}
