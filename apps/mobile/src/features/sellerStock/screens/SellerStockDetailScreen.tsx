import { type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';

import { resolvePhotoUrl } from '../../../core/api/upload';
import { useAuthStore } from '../../../core/auth/authStore';
import { type SellerStockStackParamList } from '../../../navigation/types';
import { useGiveInstructions, usePallet, usePutAway } from '../hooks/useSellerStock';
import { OVERWEIGHT_THRESHOLD_KG, STATUS_LABELS } from '../types';

interface Props {
  route: RouteProp<SellerStockStackParamList, 'SellerStockDetail'>;
}

const NEEDS_INSTRUCTIONS = ['ready_for_putaway', 'pending_admin_review'];

export function SellerStockDetailScreen({ route }: Props) {
  const { id } = route.params;
  const role = useAuthStore((state) => state.user?.role);
  const { data: pallet, isPending, error } = usePallet(id);
  const [locationDraft, setLocationDraft] = useState('');

  const giveInstructions = useGiveInstructions(id);
  const putAway = usePutAway(id);

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

      {role === 'admin' && NEEDS_INSTRUCTIONS.includes(pallet.status) && (
        <View style={styles.actionBox}>
          <Text style={styles.label}>Give put-away location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Aisle 7, bay 3"
            value={locationDraft}
            onChangeText={setLocationDraft}
          />
          {giveInstructions.error && <Text style={styles.error}>{giveInstructions.error.message}</Text>}
          <Pressable
            style={[styles.button, !locationDraft && styles.buttonDisabled]}
            disabled={!locationDraft || giveInstructions.isPending}
            onPress={() => giveInstructions.mutate(locationDraft)}
          >
            {giveInstructions.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send instructions</Text>
            )}
          </Pressable>
        </View>
      )}

      {role === 'staff' && pallet.status === 'instructed' && (
        <View style={styles.actionBox}>
          {putAway.error && <Text style={styles.error}>{putAway.error.message}</Text>}
          <Pressable style={styles.button} disabled={putAway.isPending} onPress={() => putAway.mutate()}>
            {putAway.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Confirm pallet is placed</Text>
            )}
          </Pressable>
        </View>
      )}

      {role === 'staff' && NEEDS_INSTRUCTIONS.includes(pallet.status) && (
        <Text style={styles.waiting}>Waiting on admin instructions…</Text>
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
  actionBox: {
    marginTop: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
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
