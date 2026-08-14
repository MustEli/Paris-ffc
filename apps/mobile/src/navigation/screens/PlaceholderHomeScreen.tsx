import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../core/auth/authStore';

interface PlaceholderHomeScreenProps {
  roleLabel: string;
  description: string;
}

/**
 * Shared shell for each role's landing screen. Each role's real screen
 * (Staff task list, Admin activity overview, Management dashboards —
 * see docs/architecture.md) replaces this once that feature is built;
 * for now it just proves role-based routing works and offers logout.
 */
export function PlaceholderHomeScreen({ roleLabel, description }: PlaceholderHomeScreenProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        {roleLabel} — {user?.name}
      </Text>
      <Text style={styles.title}>Nothing built here yet</Text>
      <Text style={styles.description}>{description}</Text>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
  },
  logoutButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  logoutText: {
    color: '#0f172a',
    fontWeight: '600',
  },
});
