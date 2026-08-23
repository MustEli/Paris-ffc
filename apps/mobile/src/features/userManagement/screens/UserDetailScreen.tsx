import { type RouteProp, useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type PublicUser } from '../../../core/api/users';
import { useAuthStore } from '../../../core/auth/authStore';
import { type UserManagementStackParamList } from '../../../navigation/types';
import { useChangeUserRole, useRemoveUser, useUser } from '../hooks/useUserManagement';

interface Props {
  route: RouteProp<UserManagementStackParamList, 'UserDetail'>;
}

const ROLES: PublicUser['role'][] = ['staff', 'admin', 'management'];
const ROLE_LABELS: Record<PublicUser['role'], string> = {
  staff: 'Staff',
  admin: 'Admin',
  management: 'Management',
};

export function UserDetailScreen({ route }: Props) {
  const { id } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<UserManagementStackParamList>>();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: user, isPending, error } = useUser(id);
  const [selectedRole, setSelectedRole] = useState<PublicUser['role'] | null>(null);

  const changeRole = useChangeUserRole();
  const remove = useRemoveUser();

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error || !user) {
    return <Text style={styles.error}>{error?.message ?? 'Not found'}</Text>;
  }

  const isSelf = user.id === currentUserId;
  const roleToApply = selectedRole ?? user.role;

  function handleRemove() {
    Alert.alert('Remove user', `Remove ${user!.name}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => remove.mutate(id, { onSuccess: () => navigation.goBack() }),
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.email}>{user.email}</Text>
      {isSelf && <Text style={styles.selfNote}>This is your own account.</Text>}

      <Text style={styles.label}>Role</Text>
      <View style={styles.roleRow}>
        {ROLES.map((r) => (
          <Pressable
            key={r}
            style={[styles.chip, roleToApply === r && styles.chipSelected]}
            onPress={() => setSelectedRole(r)}
          >
            <Text style={[styles.chipText, roleToApply === r && styles.chipTextSelected]}>
              {ROLE_LABELS[r]}
            </Text>
          </Pressable>
        ))}
      </View>

      {changeRole.error && <Text style={styles.error}>{changeRole.error.message}</Text>}
      <Pressable
        style={[styles.button, (roleToApply === user.role || changeRole.isPending) && styles.buttonDisabled]}
        disabled={roleToApply === user.role || changeRole.isPending}
        onPress={() => changeRole.mutate({ id, role: roleToApply })}
      >
        {changeRole.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Update role</Text>
        )}
      </Pressable>

      {!isSelf && (
        <>
          {remove.error && <Text style={styles.error}>{remove.error.message}</Text>}
          <Pressable style={styles.removeButton} disabled={remove.isPending} onPress={handleRemove}>
            {remove.isPending ? (
              <ActivityIndicator color="#dc2626" />
            ) : (
              <Text style={styles.removeButtonText}>Remove user</Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  spinner: {
    marginTop: 40,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  selfNote: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 24,
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  removeButton: {
    borderWidth: 1,
    borderColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  removeButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
});
