import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type ReceptionStackParamList } from '../../../navigation/types';
import { useCreateReception } from '../hooks/useReceptions';
import { CATEGORY_LABELS, type ReceptionCategory } from '../types';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ReceptionCategory[];

interface Props {
  navigation: NativeStackNavigationProp<ReceptionStackParamList, 'NewDelivery'>;
}

/** Doc Step 1 + 2: "New Delivery" → category → category-specific data entry. */
export function NewDeliveryScreen({ navigation }: Props) {
  const [category, setCategory] = useState<ReceptionCategory | null>(null);
  const [parcelCount, setParcelCount] = useState('');
  const [palletCount, setPalletCount] = useState('');
  const [transporterCompany, setTransporterCompany] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [itemDescription, setItemDescription] = useState('');

  const { mutate: submit, isPending, error } = useCreateReception();

  function isFormValid(): boolean {
    switch (category) {
      case 'return_parcels':
        return !!parcelCount && !!transporterCompany;
      case 'packaging_stock':
        return !!parcelCount && !!packagingType;
      case 'sellers_stock':
        return !!palletCount;
      case 'equipment_other':
        return !!parcelCount && !!itemDescription;
      default:
        return false;
    }
  }

  function handleSubmit() {
    if (!category) return;
    submit(
      {
        category,
        parcelCount: parcelCount ? Number(parcelCount) : undefined,
        palletCount: palletCount ? Number(palletCount) : undefined,
        transporterCompany: transporterCompany || undefined,
        packagingType: packagingType || undefined,
        itemDescription: itemDescription || undefined,
      },
      { onSuccess: () => navigation.navigate('ReceptionList') },
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, category === c && styles.chipSelected]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>
              {CATEGORY_LABELS[c]}
            </Text>
          </Pressable>
        ))}
      </View>

      {(category === 'return_parcels' ||
        category === 'packaging_stock' ||
        category === 'equipment_other') && (
        <>
          <Text style={styles.label}>Parcel count</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={parcelCount}
            onChangeText={setParcelCount}
          />
        </>
      )}

      {category === 'sellers_stock' && (
        <>
          <Text style={styles.label}>Pallet count</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={palletCount}
            onChangeText={setPalletCount}
          />
        </>
      )}

      {category === 'return_parcels' && (
        <>
          <Text style={styles.label}>Transporter company</Text>
          <TextInput style={styles.input} value={transporterCompany} onChangeText={setTransporterCompany} />
        </>
      )}

      {category === 'packaging_stock' && (
        <>
          <Text style={styles.label}>Packaging type</Text>
          <TextInput style={styles.input} value={packagingType} onChangeText={setPackagingType} />
        </>
      )}

      {category === 'equipment_other' && (
        <>
          <Text style={styles.label}>Item description</Text>
          <TextInput style={styles.input} value={itemDescription} onChangeText={setItemDescription} />
        </>
      )}

      {error && <Text style={styles.error}>{error.message}</Text>}

      <Pressable
        style={[styles.submitButton, (!isFormValid() || isPending) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isFormValid() || isPending}
      >
        {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Log delivery</Text>}
      </Pressable>
    </ScrollView>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
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
