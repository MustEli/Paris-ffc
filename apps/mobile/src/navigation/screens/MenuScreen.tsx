import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../../core/auth/authStore';

interface MenuItem {
  label: string;
  description: string;
  onPress: () => void;
}

interface MenuScreenProps {
  roleLabel: string;
  items: MenuItem[];
}

/** Shared hub-screen shell for each role's landing screen — a menu of that role's available modules. */
export function MenuScreen({ roleLabel, items }: MenuScreenProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  // The screen has no native header taking the bottom edge into account,
  // and "Log out" is pinned to the bottom via marginTop:'auto' — without
  // this, it renders underneath the Android gesture bar / iOS home
  // indicator instead of above it.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.eyebrow}>
        {roleLabel} — {user?.name}
      </Text>

      <View style={styles.menu}>
        {items.map((item) => (
          <Pressable key={item.label} style={styles.card} onPress={item.onPress}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </Pressable>
        ))}
      </View>

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
    padding: 24,
  },
  eyebrow: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    marginTop: 8,
  },
  menu: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 18,
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  logoutButton: {
    marginTop: 'auto',
    alignSelf: 'center',
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
