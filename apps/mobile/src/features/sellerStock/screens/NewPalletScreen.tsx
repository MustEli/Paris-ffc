import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { translateError } from '../../../core/i18n/errorCodes';
import { colors } from '../../../core/theme/colors';
import { type SellerStockStackParamList } from '../../../navigation/types';
import { MultiPhotoCapture } from '../components/MultiPhotoCapture';
import { useCreatePallet } from '../hooks/useSellerStock';
import {
  CONDITION_FLAGS,
  DELIVERY_PROOF_PHOTOS_MAX,
  DELIVERY_PROOF_PHOTOS_MIN,
  OVERWEIGHT_THRESHOLD_KG,
  type PalletConditionFlag,
} from '../types';

interface Props {
  navigation: NativeStackNavigationProp<SellerStockStackParamList, 'NewPallet'>;
}

// Local to this screen, deliberately not added to types.ts's shared
// CONDITION_FLAG_LABELS — that constant is also consumed by
// SellerStockListScreen/SellerStockDetailScreen, which aren't
// translated yet; converting it to i18n keys would break those.
const CONDITION_FLAG_LABEL_KEYS: Record<PalletConditionFlag, string> = {
  good: 'sellerStock.newPallet.conditionFlag.good',
  overweight: 'sellerStock.newPallet.conditionFlag.overweight',
  overloaded: 'sellerStock.newPallet.conditionFlag.overloaded',
  damaged: 'sellerStock.newPallet.conditionFlag.damaged',
  location_name_needed: 'sellerStock.newPallet.conditionFlag.location_name_needed',
};

/** Doc's Initial Scan + Measurement & Inspection + Branching Decision steps, all in one form. */
export function NewPalletScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [labelPhotos, setLabelPhotos] = useState<string[]>([]);
  const [boxNumber, setBoxNumber] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [conditionFlags, setConditionFlags] = useState<PalletConditionFlag[]>(['good']);
  const [damageRemarks, setDamageRemarks] = useState('');
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);

  const { mutate: submit, isPending, error } = useCreatePallet();

  const weightValue = Number(weightKg);
  const isOverweight = !!weightKg && weightValue > OVERWEIGHT_THRESHOLD_KG;
  // Exactly ['good'] is the only combination that skips Admin review —
  // matches the backend's SellerStockService.create() exactly.
  const isGoodOnly = conditionFlags.length === 1 && conditionFlags[0] === 'good';

  const isValid =
    labelPhotos.length >= DELIVERY_PROOF_PHOTOS_MIN &&
    !!boxNumber &&
    !!sellerName &&
    !!weightKg &&
    weightValue > 0 &&
    conditionFlags.length > 0 &&
    (isGoodOnly || (!!damageRemarks && damagePhotos.length > 0));

  function toggleFlag(flag: PalletConditionFlag) {
    setConditionFlags((prev) => (prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]));
  }

  function handleSubmit() {
    submit(
      {
        labelPhotoUrls: labelPhotos,
        boxNumber,
        sellerName,
        weightKg: weightValue,
        conditionFlags,
        damageRemarks: isGoodOnly ? undefined : damageRemarks,
        damageEvidencePhotoUrls: isGoodOnly ? undefined : damagePhotos,
      },
      { onSuccess: () => navigation.navigate('SellerStockList') },
    );
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.label}>{t('sellerStock.newPallet.deliveryProof')}</Text>
      <Text style={styles.hint}>
        {t('sellerStock.newPallet.deliveryProofHint', {
          min: DELIVERY_PROOF_PHOTOS_MIN,
          max: DELIVERY_PROOF_PHOTOS_MAX,
        })}
      </Text>
      <MultiPhotoCapture
        label={t('sellerStock.newPallet.deliveryProof')}
        photos={labelPhotos}
        onChange={setLabelPhotos}
        maxPhotos={DELIVERY_PROOF_PHOTOS_MAX}
      />

      <Text style={styles.label}>{t('sellerStock.newPallet.boxNumber')}</Text>
      <TextInput style={styles.input} value={boxNumber} onChangeText={setBoxNumber} placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>{t('sellerStock.newPallet.sellerName')}</Text>
      <TextInput style={styles.input} value={sellerName} onChangeText={setSellerName} placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>{t('sellerStock.newPallet.weightKg')}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={weightKg}
        onChangeText={setWeightKg}
        placeholderTextColor={colors.textMuted}
      />
      {isOverweight && (
        <Text style={styles.warning}>
          {t('sellerStock.newPallet.overweightWarning', { threshold: OVERWEIGHT_THRESHOLD_KG })}
        </Text>
      )}

      <Text style={styles.label}>{t('sellerStock.newPallet.condition')}</Text>
      <Text style={styles.hint}>{t('sellerStock.newPallet.conditionHint')}</Text>
      <View style={styles.conditionRow}>
        {CONDITION_FLAGS.map((flag) => (
          <Pressable
            key={flag}
            style={[styles.conditionChip, conditionFlags.includes(flag) && styles.conditionChipSelected]}
            onPress={() => toggleFlag(flag)}
          >
            <Text style={[styles.conditionText, conditionFlags.includes(flag) && styles.conditionTextSelected]}>
              {t(CONDITION_FLAG_LABEL_KEYS[flag])}
            </Text>
          </Pressable>
        ))}
      </View>

      {!isGoodOnly && (
        <>
          <Text style={styles.label}>{t('sellerStock.newPallet.damageRemarks')}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            multiline
            value={damageRemarks}
            onChangeText={setDamageRemarks}
            placeholderTextColor={colors.textMuted}
          />
          <MultiPhotoCapture
            label={t('sellerStock.newPallet.damageEvidencePhoto')}
            photos={damagePhotos}
            onChange={setDamagePhotos}
          />
        </>
      )}

      {error && <Text style={styles.error}>{translateError(error, t)}</Text>}

      <Pressable
        style={[styles.submitButton, (!isValid || isPending) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#1a1200" />
        ) : (
          <Text style={styles.submitText}>{t('sellerStock.newPallet.logPallet')}</Text>
        )}
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
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
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  warning: {
    color: colors.brandOrange,
    fontSize: 12,
    marginTop: 6,
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conditionChipSelected: {
    backgroundColor: colors.brandOrange,
    borderColor: colors.brandOrange,
  },
  conditionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  conditionTextSelected: {
    color: '#1a1200',
    fontWeight: '600',
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
