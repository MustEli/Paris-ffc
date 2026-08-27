import { type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { type ReceptionStackParamList } from '../../../navigation/types';
import { useAddInstructions, useCompleteReception, useReception } from '../hooks/useReceptions';
import { CATEGORY_LABELS } from '../types';
import { STATUS_LABELS, summarizeDetails } from '../utils';

interface Props {
  route: RouteProp<ReceptionStackParamList, 'ReceptionDetail'>;
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * Shared between Staff and Admin stacks — same screen, different actions
 * shown depending on role and status. Doc Steps 3–5: admin gives
 * instructions, staff confirms put-away, duration + review flag computed
 * on completion.
 */
export function ReceptionDetailScreen({ route }: Props) {
  const { id } = route.params;
  const role = useAuthStore((state) => state.user?.role);
  const { data: reception, isPending, error } = useReception(id);
  const [instructionsDraft, setInstructionsDraft] = useState('');

  const addInstructions = useAddInstructions(id);
  const complete = useCompleteReception(id);

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error || !reception) {
    return <Text style={styles.error}>{error?.message ?? 'Not found'}</Text>;
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Text style={styles.category}>{CATEGORY_LABELS[reception.details.category]}</Text>
      <Text style={styles.summary}>{summarizeDetails(reception)}</Text>
      <Text style={styles.status}>{STATUS_LABELS[reception.status]}</Text>
      <Text style={styles.meta}>Arrived: {new Date(reception.arrivedAt).toLocaleString()}</Text>

      {reception.instructions && (
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsLabel}>Instructions from admin</Text>
          <Text style={styles.instructionsText}>{reception.instructions}</Text>
        </View>
      )}

      {reception.status === 'completed' && reception.processingDurationMs !== null && (
        <>
          <Text style={styles.meta}>Put away: {new Date(reception.putAwayAt!).toLocaleString()}</Text>
          <Text style={styles.meta}>Processing time: {formatDuration(reception.processingDurationMs)}</Text>
          {reception.flaggedForReview && (
            <Text style={styles.flag}>⚠ Flagged for review — took over 2 hours</Text>
          )}
        </>
      )}

      {role === 'admin' && reception.status === 'arrived' && (
        <View style={styles.actionBox}>
          <Text style={styles.label}>Give instructions</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="e.g. Stack in aisle 4, bay 2"
            value={instructionsDraft}
            onChangeText={setInstructionsDraft}
          />
          {addInstructions.error && <Text style={styles.error}>{addInstructions.error.message}</Text>}
          <Pressable
            style={[styles.button, !instructionsDraft && styles.buttonDisabled]}
            disabled={!instructionsDraft || addInstructions.isPending}
            onPress={() => addInstructions.mutate(instructionsDraft)}
          >
            {addInstructions.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send instructions</Text>
            )}
          </Pressable>
        </View>
      )}

      {role === 'staff' && reception.status === 'ready_for_putaway' && (
        <View style={styles.actionBox}>
          {complete.error && <Text style={styles.error}>{complete.error.message}</Text>}
          <Pressable
            style={styles.button}
            disabled={complete.isPending}
            onPress={() => complete.mutate()}
          >
            {complete.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Confirm items are put away</Text>
            )}
          </Pressable>
        </View>
      )}

      {role === 'staff' && reception.status === 'arrived' && (
        <Text style={styles.waiting}>Waiting on admin instructions…</Text>
      )}
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  spinner: {
    marginTop: 40,
  },
  category: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  summary: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 4,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 10,
  },
  meta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  flag: {
    fontSize: 13,
    color: '#b45309',
    marginTop: 8,
    fontWeight: '600',
  },
  instructionsBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
  },
  instructionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    color: '#1e3a8a',
  },
  actionBox: {
    marginTop: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
  waiting: {
    marginTop: 28,
    textAlign: 'center',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
