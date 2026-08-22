import { useNavigation, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image, ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { resolvePhotoUrl } from '../../../core/api/upload';
import { useAuthStore } from '../../../core/auth/authStore';
import { type PutAwayStackParamList, type SellerStockStackParamList } from '../../../navigation/types';
import { usePallet } from '../hooks/useSellerStock';
import { OVERWEIGHT_THRESHOLD_KG, STATUS_LABELS } from '../types';

interface Props {
  route: RouteProp<SellerStockStackParamList, 'SellerStockDetail'>;
}

const NEEDS_ASSIGNMENT = ['ready_for_putaway', 'pending_admin_review'];

/**
 * Read-only pallet info + a way in to task assignment. Put-away
 * assignment itself (instructions/complete) moved to features/putAway —
 * once a task exists for this pallet, interact with it from the
 * Put-Away Tasks list rather than here (kept simple: this screen
 * doesn't look up the related task, just reflects the pallet's own
 * status/location fields, which the task flow keeps in sync).
 */
export function SellerStockDetailScreen({ route }: Props) {
  const { id } = route.params;
  const role = useAuthStore((state) => state.user?.role);
  const { data: pallet, isPending, error } = usePallet(id);
  const navigation = useNavigation<NativeStackNavigationProp<PutAwayStackParamList>>();

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error || !pallet) {
    return <Text style={styles.error}>{error?.message ?? 'Not found'}</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.index}>{pallet.palletIndex}</Text>
      <Text style={styles.status}>{STATUS_LABELS[pallet.status]}</Text>

      <View style={styles.photoRow}>
        {pallet.labelPhotoUrls.map((url) => (
          <Image key={url} source={{ uri: resolvePhotoUrl(url) }} style={styles.labelPhoto} />
        ))}
      </View>

      <Text style={styles.meta}>Seller: {pallet.sellerName}</Text>
      <Text style={styles.meta}>Box: {pallet.boxNumber}</Text>
      <Text style={styles.meta}>Weight: {pallet.weightKg}kg</Text>
      {pallet.overweightFlag && (
        <Text style={styles.flag}>⚠ Overweight (over {OVERWEIGHT_THRESHOLD_KG}kg)</Text>
      )}
      <Text style={styles.meta}>Condition: {pallet.condition === 'good' ? 'Good' : 'Damaged'}</Text>

      {pallet.condition === 'damaged' && (
        <View style={styles.damageBox}>
          <Text style={styles.damageLabel}>Damage remarks</Text>
          <Text style={styles.damageText}>{pallet.damageRemarks}</Text>
          <View style={styles.photoRow}>
            {pallet.damageEvidencePhotoUrls.map((url) => (
              <Image key={url} source={{ uri: resolvePhotoUrl(url) }} style={styles.evidenceThumb} />
            ))}
          </View>
        </View>
      )}

      {pallet.putAwayLocation && (
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsLabel}>Put-away location</Text>
          <Text style={styles.instructionsText}>{pallet.putAwayLocation}</Text>
        </View>
      )}

      {role === 'admin' && NEEDS_ASSIGNMENT.includes(pallet.status) && (
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('AssignTask', { palletId: pallet.id })}
        >
          <Text style={styles.buttonText}>Assign put-away task</Text>
        </Pressable>
      )}

      {(pallet.status === 'instructed' || pallet.status === 'put_away') && (
        <Text style={styles.waiting}>
          {pallet.status === 'put_away' ? 'Put away — see Put-Away Tasks for details.' : 'Task assigned — see Put-Away Tasks to track it.'}
        </Text>
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
  index: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 4,
    marginBottom: 14,
  },
  labelPhoto: {
    width: 110,
    height: 110,
    borderRadius: 10,
    marginBottom: 14,
    backgroundColor: '#f3f4f6',
  },
  meta: {
    fontSize: 14,
    color: '#374151',
    marginTop: 2,
  },
  flag: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '600',
    marginTop: 4,
  },
  damageBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  damageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
    marginBottom: 4,
  },
  damageText: {
    fontSize: 14,
    color: '#7f1d1d',
    marginBottom: 8,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  evidenceThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  instructionsBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
  },
  instructionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    color: '#1e3a8a',
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
  waiting: {
    marginTop: 28,
    textAlign: 'center',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
