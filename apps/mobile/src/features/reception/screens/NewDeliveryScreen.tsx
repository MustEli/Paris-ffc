import { type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DropdownPicker } from '../../../core/components/DropdownPicker';
import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { useReferenceList } from '../../../core/hooks/useReferenceList';
import { translateError } from '../../../core/i18n/errorCodes';
import { colors } from '../../../core/theme/colors';
import { type ReceptionStackParamList } from '../../../navigation/types';
import { MultiPhotoCapture } from '../../sellerStock/components/MultiPhotoCapture';
import { useCreateReception } from '../hooks/useReceptions';
import { CATEGORY_LABELS, type ReceptionCategory } from '../types';

// sellers_stock deliberately excluded — Reception no longer accepts new
// entries in that category (redundant now that Seller Stock is its own
// feature/tab, reachable via its own box on the Reception menu).
// CATEGORY_LABELS itself still includes it, unchanged, since existing
// historical receptions in that category still need to display
// correctly elsewhere (the reception list/detail screens).
const CATEGORIES = (Object.keys(CATEGORY_LABELS) as ReceptionCategory[]).filter((c) => c !== 'sellers_stock');

interface Props {
  navigation: NativeStackNavigationProp<ReceptionStackParamList, 'NewDelivery'>;
  route: RouteProp<ReceptionStackParamList, 'NewDelivery'>;
}

/** Doc Step 1 + 2: "New Delivery" → category → category-specific data entry. `presetCategory` (set when arriving from one of the Reception menu's boxes) skips the category picker entirely. */
export function NewDeliveryScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const presetCategory = route.params?.presetCategory;
  const [category, setCategory] = useState<ReceptionCategory | null>(presetCategory ?? null);
  const [parcelCount, setParcelCount] = useState('');
  const [palletCount, setPalletCount] = useState('');
  const [transporterCompany, setTransporterCompany] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [invoicePhotos, setInvoicePhotos] = useState<string[]>([]);

  const { mutate: submit, isPending, error } = useCreateReception();
  const transporterCompanies = useReferenceList('transporter_company');
  const packagingTypes = useReferenceList('packaging_type');
  const sellers = useReferenceList('seller_name');

  function isFormValid(): boolean {
    switch (category) {
      case 'return_parcels':
        return !!parcelCount && !!transporterCompany;
      case 'packaging_stock':
        return !!parcelCount && !!packagingType && !!sellerName;
      case 'sellers_stock':
        return !!palletCount;
      case 'equipment_other':
        return !!parcelCount && !!itemDescription && photos.length > 0;
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
        sellerName: sellerName || undefined,
        photoUrls: category === 'equipment_other' ? photos : undefined,
        invoicePhotoUrls:
          category === 'equipment_other' || category === 'packaging_stock' ? invoicePhotos : undefined,
      },
      { onSuccess: () => navigation.navigate('ReceptionList') },
    );
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 28 }]}>
      <Text style={styles.title}>{presetCategory ? t(CATEGORY_LABELS[presetCategory]) : t('reception.newDelivery')}</Text>

      {!presetCategory && (
        <>
          <Text style={styles.label}>{t('reception.category')}</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, category === c && styles.chipSelected]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>
                  {t(CATEGORY_LABELS[c])}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {(category === 'return_parcels' ||
        category === 'packaging_stock' ||
        category === 'equipment_other') && (
        <>
          <Text style={styles.label}>{t('reception.parcelCount')}</Text>
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
          <Text style={styles.label}>{t('reception.palletCount')}</Text>
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
          <Text style={styles.label}>{t('reception.transporterCompany')}</Text>
          <DropdownPicker
            options={transporterCompanies.data?.map((v) => v.value) ?? []}
            value={transporterCompany || null}
            onChange={setTransporterCompany}
            isLoading={transporterCompanies.isPending}
            placeholder={t('reception.selectTransporterCompany')}
            emptyLabel={t('reception.noTransporterCompanies')}
          />
        </>
      )}

      {category === 'packaging_stock' && (
        <>
          <Text style={styles.label}>{t('reception.packagingType')}</Text>
          <DropdownPicker
            options={packagingTypes.data?.map((v) => v.value) ?? []}
            value={packagingType || null}
            onChange={setPackagingType}
            isLoading={packagingTypes.isPending}
            placeholder={t('reception.selectPackagingType')}
            emptyLabel={t('reception.noPackagingTypes')}
          />

          <Text style={styles.label}>{t('reception.seller')}</Text>
          <DropdownPicker
            options={sellers.data?.map((v) => v.value) ?? []}
            value={sellerName || null}
            onChange={setSellerName}
            isLoading={sellers.isPending}
            placeholder={t('reception.selectSeller')}
            emptyLabel={t('reception.noSellers')}
          />

          <View style={styles.photoSection}>
            <MultiPhotoCapture
              label={t('reception.invoicePhotoOptional')}
              photos={invoicePhotos}
              onChange={setInvoicePhotos}
              maxPhotos={3}
            />
          </View>
        </>
      )}

      {category === 'equipment_other' && (
        <>
          <Text style={styles.label}>{t('reception.itemDescription')}</Text>
          <TextInput style={styles.input} value={itemDescription} onChangeText={setItemDescription} />

          <View style={styles.photoSection}>
            <MultiPhotoCapture label={t('reception.photoOfEquipment')} photos={photos} onChange={setPhotos} maxPhotos={6} />
          </View>
          <View style={styles.photoSection}>
            <MultiPhotoCapture
              label={t('reception.invoicePhotoOptional')}
              photos={invoicePhotos}
              onChange={setInvoicePhotos}
              maxPhotos={3}
            />
          </View>
        </>
      )}

      {error && <Text style={styles.error}>{translateError(error, t)}</Text>}

      <Pressable
        style={[styles.submitButton, (!isFormValid() || isPending) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isFormValid() || isPending}
      >
        {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('reception.logDelivery')}</Text>}
      </Pressable>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 4,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
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
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.brandOrange,
    borderColor: colors.brandOrange,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#1a1200',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  photoSection: {
    marginTop: 16,
  },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: colors.brandOrange,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#1a1200',
    fontSize: 16,
    fontWeight: '600',
  },
});
