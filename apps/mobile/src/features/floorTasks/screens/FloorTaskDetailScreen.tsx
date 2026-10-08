import { type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { useStartFloorTask } from '../hooks/useFloorTasks';
import { CATEGORY_META, type CategoryMeta } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'FloorTaskDetail'>;
  route: RouteProp<StaffStackParamList, 'FloorTaskDetail'>;
}

function metaFor(category: string): CategoryMeta {
  return CATEGORY_META.find((m) => m.category === category)!;
}

/**
 * Preview-before-you-commit step for one Floor Tasks category — nothing
 * is created on the backend here. Tapping Start is what actually calls
 * FloorTasksService.start(); before that, the Back button (or Home)
 * just leaves, exactly as if this screen had never been opened. Fixes
 * the earlier design where tapping a category in the menu started the
 * task immediately, trapping an accidental tap with no clean way out.
 */
export function FloorTaskDetailScreen({ navigation, route }: Props) {
  const meta = metaFor(route.params.category);
  const start = useStartFloorTask();

  function handleStart() {
    start.mutate(route.params.category, {
      // Replace, not navigate — this preview screen has done its job and
      // shouldn't linger in history; FloorTasks now shows the active
      // card itself since an open task exists.
      onSuccess: () => navigation.replace('FloorTasks'),
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{meta.label}</Text>
      <Text style={styles.subtitle}>Nothing starts until you press Start.</Text>

      {start.error && <Text style={styles.error}>{start.error.message}</Text>}

      <Pressable
        style={[styles.startButton, start.isPending && styles.startButtonBusy]}
        disabled={start.isPending}
        onPress={handleStart}
      >
        {start.isPending ? <ActivityIndicator color="#1a1200" /> : <Text style={styles.startText}>Start {meta.label}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: colors.brandOrange,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 999,
    alignItems: 'center',
    minWidth: 220,
  },
  startButtonBusy: {
    opacity: 0.7,
  },
  startText: {
    color: '#1a1200',
    fontSize: 17,
    fontWeight: '700',
  },
});
