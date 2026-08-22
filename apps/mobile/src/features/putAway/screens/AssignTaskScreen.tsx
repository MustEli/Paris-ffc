import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type PutAwayStackParamList } from '../../../navigation/types';
import { useAssignTask } from '../hooks/usePutAwayTasks';
import { useStaffUsers } from '../hooks/useStaffUsers';

interface Props {
  route: RouteProp<PutAwayStackParamList, 'AssignTask'>;
  navigation: NativeStackNavigationProp<PutAwayStackParamList, 'AssignTask'>;
}

/** Doc Feature 4, "Assignment": Admin picks a specific staff member + location for a pipeline pallet. */
export function AssignTaskScreen({ route, navigation }: Props) {
  const { palletId } = route.params;
  const { data: staffUsers, isPending: isLoadingStaff } = useStaffUsers();
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);
  const [location, setLocation] = useState('');

  const { mutate: submit, isPending, error } = useAssignTask();

  function handleSubmit() {
    if (!assignedToUserId) return;
    submit(
      { palletId, assignedToUserId, location },
      { onSuccess: () => navigation.navigate('PutAwayTaskList') },
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Assign to</Text>
      {isLoadingStaff ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.staffList}>
          {staffUsers?.map((user) => (
            <Pressable
              key={user.id}
              style={[styles.staffChip, assignedToUserId === user.id && styles.staffChipSelected]}
              onPress={() => setAssignedToUserId(user.id)}
            >
              <Text
                style={[styles.staffChipText, assignedToUserId === user.id && styles.staffChipTextSelected]}
              >
                {user.name}
              </Text>
            </Pressable>
          ))}
          {staffUsers?.length === 0 && <Text style={styles.empty}>No staff users found.</Text>}
        </View>
      )}

      <Text style={styles.label}>Put-away location</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Aisle 7, bay 3"
        value={location}
        onChangeText={setLocation}
      />

      {error && <Text style={styles.error}>{error.message}</Text>}

      <Pressable
        style={[styles.button, (!assignedToUserId || !location || isPending) && styles.buttonDisabled]}
        disabled={!assignedToUserId || !location || isPending}
        onPress={handleSubmit}
      >
        {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Assign task</Text>}
      </Pressable>
    </ScrollView>
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
    marginTop: 16,
    marginBottom: 6,
  },
  staffList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  empty: {
    color: '#9ca3af',
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
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
