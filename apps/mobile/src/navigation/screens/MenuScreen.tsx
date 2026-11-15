import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../../core/auth/authStore';

const BRAND_ORANGE = '#fd8c1e';

interface MenuItem {
  label: string;
  description: string;
  onPress: () => void;
  /** When true, the card can't be opened at all (not just its actions) — e.g. Staff without an active shift. */
  disabled?: boolean;
  /** Shown instead of `description` while disabled, if provided — e.g. "Start your shift to unlock this." */
  disabledHint?: string;
  /** Leading icon in a tinted circle — optional so existing callers keep working without it. */
  icon?: ComponentProps<typeof Ionicons>['name'];
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
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.card,
              item.disabled && styles.cardDisabled,
              pressed && !item.disabled && styles.cardPressed,
            ]}
            onPress={item.onPress}
            disabled={item.disabled}
          >
            <View style={styles.cardRow}>
              {item.icon && (
                <View style={[styles.iconBadge, item.disabled && styles.iconBadgeDisabled]}>
                  <Ionicons name={item.icon} size={20} color={item.disabled ? '#9ca3af' : BRAND_ORANGE} />
                </View>
              )}
              <View style={styles.cardText}>
                <Text style={[styles.cardLabel, item.disabled && styles.cardLabelDisabled]}>{item.label}</Text>
                <Text style={styles.cardDescription}>
                  {item.disabled && item.disabledHint ? item.disabledHint : item.description}
                </Text>
              </View>
              {!item.disabled && <Ionicons name="chevron-forward" size={18} color="#9ca3af" />}
            </View>
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: '#f9fafb',
  },
  cardDisabled: {
    backgroundColor: '#f9fafb',
    opacity: 0.6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff1e2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconBadgeDisabled: {
    backgroundColor: '#f1f5f9',
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardLabelDisabled: {
    color: '#9ca3af',
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
