import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolvePhotoUrl } from '../../../core/api/upload';
import { useAuthStore } from '../../../core/auth/authStore';
import { APP_LANGUAGES, type AppLanguage } from '../../../core/i18n/i18n';
import { useLanguageStore } from '../../../core/i18n/languageStore';
import { useActiveTaskGuardStore } from '../../../core/navigation/activeTaskGuardStore';
import { useCurrentRouteStore } from '../../../core/navigation/currentRouteStore';
import { navigationRef } from '../../../core/navigation/navigationRef';
import { useUnsavedChangesStore } from '../../../core/navigation/unsavedChangesStore';
import { colors } from '../../../core/theme/colors';
import { useMyOpenPoolTasks } from '../../openPool/hooks/useOpenPool';
import { useOrderPrepTasks } from '../../orderPrep/hooks/useOrderPrep';
import { useTasks as usePutAwayTasks } from '../../putAway/hooks/usePutAwayTasks';
import { useMySchedule } from '../../schedule/hooks/useMySchedule';
import { useShiftStatus } from '../hooks/useShiftStatus';

const LANGUAGE_NATIVE_NAME: Record<AppLanguage, string> = { en: 'English', fr: 'Français' };

function formatDate(date: Date, locale: AppLanguage): string {
  return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** The main-menu route — the one screen that never shows the Home icon. */
const MAIN_MENU_ROUTE = 'StaffHome';

/**
 * Persistent header, shown on every Staff screen once a shift starts —
 * see docs on the redesign for the full spec. Lives above the content
 * area; StaffAppShell is what actually gates the content below it
 * while on break (this component just reflects state and offers the
 * actions, it doesn't render the lock itself).
 */
export function ShiftStatusBar() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const routeName = useCurrentRouteStore((state) => state.routeName);
  const { data: schedule } = useMySchedule();
  const {
    status,
    end,
    isEnding,
    startBreak,
    isStartingBreak,
    endBreak,
    isEndingBreak,
  } = useShiftStatus();

  const [isOpen, setIsOpen] = useState(false);

  // Assigned-to-me work that isn't done yet — shown everywhere via this
  // bar so it can't be missed on whatever screen staff happens to be
  // on. Directives are deliberately excluded: they already block the
  // whole screen with their own overlay the instant one arrives, so a
  // second reminder here would be redundant. Floor Tasks are
  // self-started, not assigned, so they don't belong in this list
  // either — and leaving one running already blocks navigation on its
  // own (see activeTaskGuardStore).
  const { data: putAwayTasks } = usePutAwayTasks();
  const { data: orderPrepTasks } = useOrderPrepTasks();
  const { data: openPoolTasks } = useMyOpenPoolTasks();
  const pendingItems = [
    ...(putAwayTasks ?? [])
      .filter((t) => t.status !== 'completed')
      .map((t) => ({ key: `put-away:${t.id}`, label: `Put-away — ${t.location}` })),
    ...(orderPrepTasks ?? [])
      .filter((t) => t.status !== 'completed')
      .map((t) => ({ key: `order-prep:${t.id}`, label: `Order prep — ${t.role === 'picker' ? 'Picker' : 'Packer'}` })),
    ...(openPoolTasks ?? []).map((t) => ({ key: `open-pool:${t.id}`, label: t.title })),
  ];

  if (!status?.active || !status.startedAt) return null;

  const now = new Date();
  const onBreak = status.onBreak;
  const onLunchBreak = onBreak && status.breakType === 'lunch';
  const onShortBreak = onBreak && status.breakType === 'short';
  const shortBreakAvailable = status.shortBreakRemainingMs > 0;
  // Neither Back nor Home make sense on the main menu — it's the root of
  // the stack, nothing to go back to and nowhere else "home" would mean.
  const showNavIcons = routeName !== null && routeName !== MAIN_MENU_ROUTE;

  /** Confirms before discarding an in-progress form (same guard for both Back and Home), then runs `action`. */
  function withUnsavedGuard(action: () => void) {
    if (useUnsavedChangesStore.getState().hasUnsavedChanges) {
      Alert.alert(t('shiftBar.discardTitle'), t('shiftBar.discardMessage'), [
        { text: t('shiftBar.keepEditing'), style: 'cancel' },
        {
          text: t('shiftBar.discard'),
          style: 'destructive',
          onPress: () => {
            useUnsavedChangesStore.getState().setHasUnsavedChanges(false);
            action();
          },
        },
      ]);
      return;
    }
    action();
  }

  function goHome() {
    if (useActiveTaskGuardStore.getState().isTaskRunning) {
      Alert.alert(t('floorTasks.pauseFirstTitle'), t('floorTasks.pauseFirstMessage'));
      return;
    }
    withUnsavedGuard(() => {
      setIsOpen(false);
      if (navigationRef.isReady()) {
        navigationRef.navigate(MAIN_MENU_ROUTE as never);
      }
    });
  }

  function goBack() {
    withUnsavedGuard(() => {
      setIsOpen(false);
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
      }
    });
  }

  function confirmEndShift() {
    Alert.alert(t('shiftBar.confirmEndShiftTitle'), t('shiftBar.confirmEndShiftMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('shiftBar.endShift'),
        style: 'destructive',
        onPress: () => {
          setIsOpen(false);
          end();
        },
      },
    ]);
  }

  function toggleLanguage() {
    const next = APP_LANGUAGES.find((l) => l !== language) ?? 'en';
    setLanguage(next);
  }

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.tricolor}>
        <View style={[styles.tricolorSegment, { backgroundColor: colors.brandBlue }]} />
        <View style={[styles.tricolorSegment, { backgroundColor: '#f8fafc' }]} />
        <View style={[styles.tricolorSegment, { backgroundColor: colors.brandRed }]} />
      </View>
      <View style={[styles.bar, pendingItems.length > 0 && styles.barPending]}>
        <View style={styles.row}>
          {showNavIcons && (
            <Pressable style={styles.navButton} onPress={goBack} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>
          )}
          {showNavIcons && (
            <Pressable style={styles.navButton} onPress={goHome} hitSlop={8}>
              <Ionicons name="home" size={22} color={colors.textPrimary} />
            </Pressable>
          )}

          <View style={styles.identity}>
            {user?.photoUrl ? (
              <Image source={{ uri: resolvePhotoUrl(user.photoUrl) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={18} color={colors.textMuted} />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {user?.name}
            </Text>
          </View>

          <View style={styles.statusColumn}>
            <Text style={styles.subline}>
              {schedule ? `${t('shiftBar.ends', { time: schedule.shiftEndTime })} · ` : ''}
              {formatDate(now, language)}
            </Text>
          </View>
        </View>

        {onBreak && (
          <Text style={styles.breakBanner}>{onLunchBreak ? t('shiftGate.onLunchBreak') : t('shiftGate.onShortBreak')}</Text>
        )}

        {pendingItems.length > 0 && (
          <Pressable onPress={() => setIsOpen(true)}>
            <Text style={styles.pendingBanner}>
              {t('shiftBar.pendingTasks', { count: pendingItems.length })}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={styles.chevronButton}
          onPress={() => setIsOpen((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {isOpen && (
        <>
          <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
          <View style={styles.dropdown}>
            {pendingItems.length > 0 && (
              <View style={styles.pendingSection}>
                <Text style={styles.pendingSectionTitle}>{t('shiftBar.pendingTasksTitle')}</Text>
                {pendingItems.map((item) => (
                  <Text key={item.key} style={styles.pendingItem}>
                    •  {item.label}
                  </Text>
                ))}
              </View>
            )}
            {!onBreak && (
              <>
                <Pressable
                  style={styles.dropdownRow}
                  disabled={isStartingBreak}
                  onPress={() => {
                    setIsOpen(false);
                    startBreak('lunch');
                  }}
                >
                  <Text style={styles.dropdownLabel}>{t('shiftBar.lunchBreak')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.dropdownRow, !shortBreakAvailable && styles.dropdownRowDisabled]}
                  disabled={isStartingBreak || !shortBreakAvailable}
                  onPress={() => {
                    setIsOpen(false);
                    startBreak('short');
                  }}
                >
                  <Text style={[styles.dropdownLabel, !shortBreakAvailable && styles.dropdownLabelDisabled]}>
                    {shortBreakAvailable ? t('shiftBar.shortBreak') : t('shiftBar.shortBreakUsedUp')}
                  </Text>
                </Pressable>
              </>
            )}
            {onBreak && (
              <Pressable
                style={styles.dropdownRow}
                disabled={isEndingBreak}
                onPress={() => {
                  setIsOpen(false);
                  endBreak();
                }}
              >
                <Text style={styles.dropdownLabel}>
                  {onLunchBreak ? t('shiftBar.endLunchBreak') : t('shiftBar.endShortBreak')}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.dropdownRow} onPress={toggleLanguage}>
              <View style={styles.dropdownRowBetween}>
                <Text style={styles.dropdownLabel}>{t('shiftBar.language')}</Text>
                <Text style={styles.dropdownLanguageValue}>{LANGUAGE_NATIVE_NAME[language]}</Text>
              </View>
            </Pressable>
            <Pressable style={styles.dropdownRow} disabled={isEnding} onPress={confirmEndShift}>
              <Text style={styles.dropdownLabelDanger}>{t('shiftBar.endShift')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surfaceElevated,
    zIndex: 20,
  },
  tricolor: {
    flexDirection: 'row',
    height: 6,
  },
  tricolorSegment: {
    flex: 1,
  },
  bar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barPending: {
    backgroundColor: colors.brandOrange + '1a',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  statusColumn: {
    alignItems: 'flex-end',
  },
  subline: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  breakBanner: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandOrange,
    textAlign: 'center',
  },
  pendingBanner: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandOrange,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  chevronButton: {
    alignSelf: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  backdrop: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    height: 2000,
    backgroundColor: colors.scrim,
    zIndex: 19,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingBottom: 8,
    zIndex: 21,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  dropdownRow: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pendingSection: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: colors.brandOrange + '1a',
  },
  pendingSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandOrange,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pendingItem: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  dropdownRowDisabled: {
    opacity: 0.4,
  },
  dropdownLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dropdownLabelDisabled: {
    color: colors.textMuted,
  },
  dropdownRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownLanguageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brandOrange,
  },
  dropdownLabelDanger: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.alert,
  },
});
