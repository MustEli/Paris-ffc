import { Ionicons } from '@expo/vector-icons';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { useMyActiveReceptionTask, useResumeReceptionTask, useStartReceptionTask } from '../hooks/useReceptionTasks';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'ReceptionStart'>;
}

/**
 * The gate in front of Reception's category menu — nothing (not even
 * the category picker) is reachable until a ReceptionTask exists, so
 * its start/stop timing covers the whole trip, not just one category's
 * form. Three states: nothing running (show Start), something running
 * already (e.g. the app was backgrounded and relaunched — skip
 * straight through), or something paused (auto-resume, then skip
 * through). `replace` (not `navigate`) on every "move on" path so this
 * gate never sits underneath ReceptionMenu in the stack — Android back
 * from there should land on the Main Menu, not bounce back here.
 */
export function ReceptionStartScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { data: activeTask, isPending } = useMyActiveReceptionTask();
  const start = useStartReceptionTask();
  const resume = useResumeReceptionTask(activeTask?.id ?? '');
  const hasActed = useRef(false);

  useEffect(() => {
    if (isPending || hasActed.current) return;
    if (activeTask && !activeTask.pausedAt) {
      hasActed.current = true;
      navigation.replace('ReceptionMenu');
      return;
    }
    if (activeTask && activeTask.pausedAt) {
      hasActed.current = true;
      resume.mutate(undefined, { onSuccess: () => navigation.replace('ReceptionMenu') });
    }
    // Nothing active — stay put and show the Start button below.
  }, [isPending, activeTask, navigation, resume]);

  function handleStart() {
    start.mutate(undefined, { onSuccess: () => navigation.replace('ReceptionMenu') });
  }

  const isResuming = !!activeTask;

  if (isPending || isResuming) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandOrange} />
        {isResuming && <Text style={styles.resuming}>{t('receptionStart.resuming')}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('receptionStart.title')}</Text>
      <Text style={styles.subtitle}>{t('receptionStart.subtitle')}</Text>
      <Pressable
        style={[styles.startButton, start.isPending && styles.buttonBusy]}
        disabled={start.isPending}
        onPress={handleStart}
      >
        {start.isPending ? (
          <ActivityIndicator color="#1a1200" />
        ) : (
          <>
            <Ionicons name="play-circle-outline" size={18} color="#1a1200" style={styles.startButtonIcon} />
            <Text style={styles.startButtonText}>{t('receptionStart.start')}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  resuming: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 8,
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: colors.brandOrange,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  startButtonIcon: {
    marginRight: 8,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  startButtonText: {
    color: '#1a1200',
    fontSize: 16,
    fontWeight: '700',
  },
});
