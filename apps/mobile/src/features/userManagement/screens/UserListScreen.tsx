import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { type UserManagementStackParamList } from '../../../navigation/types';
import { useAllUsers } from '../hooks/useUserManagement';

interface Props {
  navigation: NativeStackNavigationProp<UserManagementStackParamList, 'UserList'>;
}

const ROLE_LABELS: Record<string, string> = {
  staff: 'Staff',
  admin: 'Admin',
  management: 'Management',
};

/** Doc: "Admin ... should be able to create and remove the accesses and assign different access to different member." */
export function UserListScreen({ navigation }: Props) {
  const { data: users, isPending, error, refetch, isRefetching } = useAllUsers();

  return (
    <View style={styles.container}>
      <Pressable style={styles.newButton} onPress={() => navigation.navigate('NewUser')}>
        <Text style={styles.newButtonText}>+ New User</Text>
      </Pressable>

      {isPending && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('UserDetail', { id: item.id })}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
            </View>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{ROLE_LABELS[item.role]}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  newButton: {
    margin: 16,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  spinner: {
    marginTop: 24,
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  email: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  rolePill: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: '#3730a3',
    fontSize: 12,
    fontWeight: '600',
  },
});
