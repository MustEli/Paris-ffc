import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { resolvePhotoUrl, uploadPhoto } from '../../../core/api/upload';
import { useAuthStore } from '../../../core/auth/authStore';
import { compressForUpload } from '../../../core/media/compressImage';
import { colors } from '../../../core/theme/colors';

interface Props {
  label: string;
  value: string | null; // relative URL ("/uploads/xyz.jpg"), once uploaded
  onChange: (relativeUrl: string) => void;
}

/**
 * Camera capture + immediate upload, single photo. Used for the label
 * photo and, one-at-a-time, for damage evidence photos (see
 * DamageEvidenceCapture, which renders a list of these).
 */
export function PhotoCaptureButton({ label, value, onChange }: Props) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError(t('photoCapture.cameraPermissionRequired'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;

    setIsUploading(true);
    try {
      const compressedUri = await compressForUpload(result.assets[0].uri);
      const url = await uploadPhoto(token!, compressedUri);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('photoCapture.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.tapArea} onPress={handleCapture} disabled={isUploading}>
        {isUploading ? (
          <ActivityIndicator color={colors.brandOrange} />
        ) : value ? (
          <Image source={{ uri: resolvePhotoUrl(value) }} style={styles.thumbnail} />
        ) : (
          <Text style={styles.placeholder}>{t('photoCapture.tapToTakePhoto')}</Text>
        )}
      </Pressable>
      {value && !isUploading && <Text style={styles.retake}>{t('photoCapture.tapToRetake')}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  tapArea: {
    height: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  retake: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  error: {
    color: colors.alert,
    fontSize: 12,
    marginTop: 4,
  },
});
