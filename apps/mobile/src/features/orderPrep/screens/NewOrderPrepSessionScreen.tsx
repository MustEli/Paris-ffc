import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { type OrderPrepStackParamList } from '../../../navigation/types';
import { useCreateSession } from '../hooks/useOrderPrep';

interface Props {
  navigation: NativeStackNavigationProp<OrderPrepStackParamList, 'NewOrderPrepSession'>;
}

/** Doc's Planning step: Admin inputs total volume, system calculates required personnel. */
export function NewOrderPrepSessionScreen({ navigation }: Props) {
  const [totalParts, setTotalParts] = useState('');
  const { mutate: submit, isPending, error } = useCreateSession();

  function handleSubmit() {
    const value = Number(totalParts);
    if (!value || value <= 0) return;
    submit(value, {
      onSuccess: (session) =>
        navigation.replace('OrderPrepSessionDetail', { id: session.id }),
    });
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Text style={styles.label}>Total parts to process</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={totalParts}
        onChangeText={setTotalParts}
        placeholder="e.g. 350"
      />
      <Text style={styles.hint}>
        Staffing is calculated from baseline throughput (25 parts/hr per picker, 20 per packer) over a
        7-hour shift.
      </Text>

      {error && <Text style={styles.error}>{error.message}</Text>}

      <Pressable
        style={[styles.button, (!totalParts || isPending) && styles.buttonDisabled]}
        disabled={!totalParts || isPending}
        onPress={handleSubmit}
      >
        {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Calculate & create</Text>}
      </Pressable>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
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
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 16,
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
