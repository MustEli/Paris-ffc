import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { useUnsavedChangesStore } from '../../../core/navigation/unsavedChangesStore';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { MultiPhotoCapture } from '../../sellerStock/components/MultiPhotoCapture';
import { useCreateIssueReport } from '../hooks/useIssueReports';
import { metaFor } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'IssueReportForm'>;
  route: RouteProp<StaffStackParamList, 'IssueReportForm'>;
}

const TRACKING_ID_PATTERN = /^[A-Z0-9]+$/;
const NUMERIC_ONLY_PATTERN = /^[0-9]+$/;
const LOCATION_ID_PATTERN = /^[A-Za-z0-9]+$/;

/** One screen for all 9 categories, driven by CATEGORY_META — see issue-report.types.ts on the backend for why these are fixed fields rather than an Admin-editable form builder. */
export function IssueReportFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const meta = metaFor(route.params.category);
  const [photos, setPhotos] = useState<string[]>([]);
  const [trackingId, setTrackingId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [errorNo, setErrorNo] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [locationId, setLocationId] = useState('');
  const [comment, setComment] = useState('');

  const create = useCreateIssueReport();
  const setHasUnsavedChanges = useUnsavedChangesStore((state) => state.setHasUnsavedChanges);

  const hasAnyInput =
    photos.length > 0 || !!trackingId || !!orderNumber || !!errorNo || !!idNumber || !!locationId || !!comment;
  useEffect(() => {
    setHasUnsavedChanges(hasAnyInput);
  }, [hasAnyInput, setHasUnsavedChanges]);
  // Clears the flag on the way out regardless of how — submitted, backed
  // out, or jumped Home (which already asked for confirmation before
  // getting here).
  useEffect(() => () => setHasUnsavedChanges(false), [setHasUnsavedChanges]);

  const trackingIdValid = !meta.trackingId || TRACKING_ID_PATTERN.test(trackingId);
  const orderNumberValid = !meta.orderNumber || NUMERIC_ONLY_PATTERN.test(orderNumber);
  const idNumberValid = !meta.idNumber || NUMERIC_ONLY_PATTERN.test(idNumber);
  const locationIdValid = !meta.locationId || LOCATION_ID_PATTERN.test(locationId);

  const isValid =
    (!meta.photos || meta.photos.optional || photos.length > 0) &&
    (!meta.trackingId || (trackingId.trim() !== '' && trackingIdValid)) &&
    (!meta.orderNumber || (orderNumber.trim() !== '' && orderNumberValid)) &&
    (!meta.errorNo || errorNo.trim() !== '') &&
    (!meta.idNumber || (idNumber.trim() !== '' && idNumberValid)) &&
    (!meta.locationId || (locationId.trim() !== '' && locationIdValid)) &&
    (!meta.comment || comment.trim() !== '');

  function handleSubmit() {
    create.mutate(
      {
        category: route.params.category,
        photoUrls: meta.photos ? photos : undefined,
        trackingId: meta.trackingId ? trackingId.trim().toUpperCase() : undefined,
        orderNumber: meta.orderNumber ? orderNumber.trim() : undefined,
        errorNo: meta.errorNo ? errorNo.trim() : undefined,
        idNumber: meta.idNumber ? idNumber.trim() : undefined,
        locationId: meta.locationId ? locationId.trim() : undefined,
        comment: meta.comment ? comment.trim() : undefined,
      },
      {
        onSuccess: () => {
          setHasUnsavedChanges(false);
          navigation.goBack();
        },
      },
    );
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
      <Text style={styles.title}>{meta.label}</Text>

      {meta.photos && (
        <View style={styles.field}>
          <MultiPhotoCapture label={meta.photos.label} photos={photos} onChange={setPhotos} maxPhotos={meta.photos.max} />
        </View>
      )}

      {meta.trackingId && (
        <View style={styles.field}>
          <Text style={styles.label}>{meta.trackingId.label}</Text>
          <TextInput
            style={styles.input}
            value={trackingId}
            onChangeText={setTrackingId}
            autoCapitalize="characters"
            placeholder="e.g. ABC123"
            placeholderTextColor={colors.textMuted}
          />
          {trackingId.length > 0 && !trackingIdValid && (
            <Text style={styles.fieldError}>Capital letters and numbers only, no spaces.</Text>
          )}
        </View>
      )}

      {meta.orderNumber && (
        <View style={styles.field}>
          <Text style={styles.label}>{meta.orderNumber.label}</Text>
          <TextInput
            style={styles.input}
            value={orderNumber}
            onChangeText={setOrderNumber}
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
          />
          {orderNumber.length > 0 && !orderNumberValid && <Text style={styles.fieldError}>Numbers only.</Text>}
        </View>
      )}

      {meta.errorNo && (
        <View style={styles.field}>
          <Text style={styles.label}>{meta.errorNo.label}</Text>
          <TextInput style={styles.input} value={errorNo} onChangeText={setErrorNo} placeholderTextColor={colors.textMuted} />
        </View>
      )}

      {meta.idNumber && (
        <View style={styles.field}>
          <Text style={styles.label}>{meta.idNumber.label}</Text>
          <TextInput
            style={styles.input}
            value={idNumber}
            onChangeText={setIdNumber}
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
          />
          {idNumber.length > 0 && !idNumberValid && <Text style={styles.fieldError}>Numbers only.</Text>}
        </View>
      )}

      {meta.locationId && (
        <View style={styles.field}>
          <Text style={styles.label}>{meta.locationId.label}</Text>
          <TextInput
            style={styles.input}
            value={locationId}
            onChangeText={setLocationId}
            autoCapitalize="characters"
            placeholderTextColor={colors.textMuted}
          />
          {locationId.length > 0 && !locationIdValid && (
            <Text style={styles.fieldError}>Letters and numbers only, no spaces.</Text>
          )}
        </View>
      )}

      {meta.comment && (
        <View style={styles.field}>
          <Text style={styles.label}>{meta.comment.label}</Text>
          {meta.comment.hint && <Text style={styles.hint}>{meta.comment.hint}</Text>}
          <TextInput
            style={[styles.input, styles.multiline]}
            value={comment}
            onChangeText={setComment}
            multiline
            placeholderTextColor={colors.textMuted}
          />
        </View>
      )}

      {create.error && <Text style={styles.fieldError}>{create.error.message}</Text>}

      <Pressable
        style={[styles.submitButton, (!isValid || create.isPending) && styles.submitButtonDisabled]}
        disabled={!isValid || create.isPending}
        onPress={handleSubmit}
      >
        {create.isPending ? <ActivityIndicator color="#1a1200" /> : <Text style={styles.submitText}>Submit</Text>}
      </Pressable>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 48,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldError: {
    color: colors.alert,
    fontSize: 12,
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: colors.brandOrange,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#1a1200',
    fontSize: 16,
    fontWeight: '700',
  },
});
