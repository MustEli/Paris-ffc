import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { type SellerStockStackParamList } from '../../../navigation/types';
import { MultiPhotoCapture } from '../components/MultiPhotoCapture';
import { useCreatePallet } from '../hooks/useSellerStock';
import { OVERWEIGHT_THRESHOLD_KG, type PalletCondition } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<SellerStockStackParamList, 'NewPallet'>;
}

/** Doc's Initial Scan + Measurement & Inspection + Branching Decision steps, all in one form. */
export function NewPalletScreen({ navigation }: Props) {
  const [labelPhotos, setLabelPhotos] = useState<string[]>([]);
  const [boxNumber, setBoxNumber] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [condition, setCondition] = useState<PalletCondition>('good');
  const [damageRemarks, setDamageRemarks] = useState('');
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);

  const { mutate: submit, isPending, error } = useCreatePallet();

  const weightValue = Number(weightKg);
  const isOverweight = !!weightKg && weightValue > OVERWEIGHT_THRESHOLD_KG;

  const isValid =
    labelPhotos.length > 0 &&
    !!boxNumber &&
    !!sellerName &&
    !!weightKg &&
    weightValue > 0 &&
    (condition === 'good' || (!!damageRemarks && damagePhotos.length > 0));

  function handleSubmit() {
    submit(
      {
        labelPhotoUrls: labelPhotos,
        boxNumber,
        sellerName,
        weightKg: weightValue,
        condition,
        damageRemarks: condition === 'damaged' ? damageRemarks : undefined,
        damageEvidencePhotoUrls: condition === 'damaged' ? damagePhotos : undefined,
      },
      { onSuccess: () => navigation.navigate('SellerStockList') },
    );
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <MultiPhotoCapture label="Shipping label photo" photos={labelPhotos} onChange={setLabelPhotos} />

      <Text style={styles.label}>Box number</Text>
      <TextInput style={styles.input} value={boxNumber} onChangeText={setBoxNumber} />

      <Text style={styles.label}>Seller name</Text>
      <TextInput style={styles.input} value={sellerName} onChangeText={setSellerName} />

      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} />
      {isOverweight && (
        <Text style={styles.warning}>⚠ Over {OVERWEIGHT_THRESHOLD_KG}kg — will be flagged for admin review.</Text>
      )}

      <Text style={styles.label}>Condition</Text>
      <View style={styles.conditionRow}>
        {(['good', 'damaged'] as PalletCondition[]).map((c) => (
          <Pressable
            key={c}
            style={[styles.conditionChip, condition === c && styles.conditionChipSelected]}
            onPress={() => setCondition(c)}
          >
            <Text style={[styles.conditionText, condition === c && styles.conditionTextSelected]}>
              {c === 'good' ? 'Good' : 'Damaged'}
            </Text>
          </Pressable>
        ))}
      </View>

      {condition === 'damaged' && (
        <>
          <Text style={styles.label}>Damage remarks</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            multiline
            value={damageRemarks}
            onChangeText={setDamageRemarks}
          />
          <MultiPhotoCapture label="Damage evidence photo" photos={damagePhotos} onChange={setDamagePhotos} />
        </>
      )}

      {error && <Text style={styles.error}>{error.message}</Text>}

      <Pressable
        style={[styles.submitButton, (!isValid || isPending) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || isPending}
      >
        {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Log pallet</Text>}
      </Pressable>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
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
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  warning: {
    color: '#b45309',
    fontSize: 12,
    marginTop: 6,
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  conditionChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  conditionChipSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  conditionText: {
    fontSize: 13,
    color: '#374151',
  },
  conditionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
