import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Role, useAuthStore } from '../../core/auth/authStore';

const ROLES: { role: Role; label: string }[] = [
  { role: 'staff', label: 'Continue as Staff' },
  { role: 'admin', label: 'Continue as Admin' },
  { role: 'management', label: 'Continue as Management' },
];

/**
 * TEMPORARY MOCK LOGIN SCREEN.
 * Picks a role directly with no credentials — there's no backend yet.
 * Once auth exists, this becomes a real login form that resolves a role
 * from the server response instead of letting the user pick one.
 */
export function LoginScreen() {
  const login = useAuthStore((state) => state.login);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Warehouse HQ</Text>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.notice}>
        Mock login — no backend yet. Pick a role to preview its screens.
      </Text>

      <View style={styles.buttonGroup}>
        {ROLES.map(({ role, label }) => (
          <Pressable
            key={role}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => login(role)}
          >
            <Text style={styles.buttonText}>{label}</Text>
          </Pressable>
        ))}
      </View>
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
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  notice: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
