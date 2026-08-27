import { type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { useStaffUsers } from '../../../core/hooks/useStaffUsers';
import { type PutAwayStackParamList } from '../../../navigation/types';
import {
  useCompleteTask,
  useReassignTask,
  useReportIssue,
  useStartTask,
  useTask,
} from '../hooks/usePutAwayTasks';
import { STATUS_LABELS } from '../types';

interface Props {
  route: RouteProp<PutAwayStackParamList, 'PutAwayTaskDetail'>;
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Doc Feature 4 Execution & Branching: Start → Complete (Branch A) or Report Issue (Branch B) → Admin reassigns. */
export function PutAwayTaskDetailScreen({ route }: Props) {
  const { id } = route.params;
  const role = useAuthStore((state) => state.user?.role);
  const { data: task, isPending, error } = useTask(id);
  const [issueDraft, setIssueDraft] = useState('');
  const [reassignTo, setReassignTo] = useState<string | null>(null);

  const start = useStartTask(id);
  const complete = useCompleteTask(id);
  const report = useReportIssue(id);
  const reassign = useReassignTask(id);
  const { data: staffUsers } = useStaffUsers();

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error || !task) {
    return <Text style={styles.error}>{error?.message ?? 'Not found'}</Text>;
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Text style={styles.location}>{task.location}</Text>
      <Text style={styles.status}>{STATUS_LABELS[task.status]}</Text>
      <Text style={styles.meta}>Assigned: {new Date(task.assignedAt).toLocaleString()}</Text>
      {task.startedAt && <Text style={styles.meta}>Started: {new Date(task.startedAt).toLocaleString()}</Text>}
      {task.durationMs !== null && <Text style={styles.meta}>Took {formatDuration(task.durationMs)}</Text>}

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
            {start.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start task</Text>}
          </Pressable>
          <ReportIssueForm draft={issueDraft} setDraft={setIssueDraft} report={report} />
        </View>
      )}

      {role === 'staff' && task.status === 'in_progress' && (
        <View style={styles.actionBox}>
          {complete.error && <Text style={styles.error}>{complete.error.message}</Text>}
          <Pressable style={styles.button} disabled={complete.isPending} onPress={() => complete.mutate()}>
            {complete.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Task completed</Text>
            )}
          </Pressable>
          <ReportIssueForm draft={issueDraft} setDraft={setIssueDraft} report={report} />
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
              <Text style={styles.buttonText}>Reassign task</Text>
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAwareScreen>
  );
}

function ReportIssueForm({
  draft,
  setDraft,
  report,
}: {
  draft: string;
  setDraft: (v: string) => void;
  report: ReturnType<typeof useReportIssue>;
}) {
  return (
    <View style={styles.reportBox}>
      <Text style={styles.label}>Blocked? Report an issue</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Too many heavy boxes"
        value={draft}
        onChangeText={setDraft}
      />
      {report.error && <Text style={styles.error}>{report.error.message}</Text>}
      <Pressable
        style={[styles.secondaryButton, !draft && styles.buttonDisabled]}
        disabled={!draft || report.isPending}
        onPress={() => report.mutate(draft)}
      >
        <Text style={styles.secondaryButtonText}>Report issue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  spinner: {
    marginTop: 40,
  },
  location: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
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
    color: '#9ca3af',
    marginTop: 2,
  },
  issueBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  issueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
    marginBottom: 4,
  },
  issueText: {
    fontSize: 14,
    color: '#7f1d1d',
  },
  actionBox: {
    marginTop: 28,
  },
  reportBox: {
    marginTop: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
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
    borderColor: '#d1d5db',
  },
  staffChipSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  staffChipText: {
    fontSize: 13,
    color: '#374151',
  },
  staffChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 8,
  },
});
