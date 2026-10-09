import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { uploadPhoto } from '../../../core/api/upload';
import { setMyPhoto } from '../../../core/api/users';
import { useAuthStore } from '../../../core/auth/authStore';
import { translateError } from '../../../core/i18n/errorCodes';
import { compressForUpload } from '../../../core/media/compressImage';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'SelfieCapture'>;
}

/**
 * Shown once, the first time a staff member ever starts a shift (see
 * StaffAppShell — triggered when user.photoUrl is still null right
 * after Start Shift succeeds). Front camera, one photo, no retake flow
 * beyond "take it again" — this isn't an ID check, just a face for the
 * shift-status bar.
 */
export function SelfieCaptureScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const setPhotoUrl = useAuthStore((state) => state.setPhotoUrl);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError(t('selfie.cameraPermissionRequired'));
      return;
    }
    // No allowsEditing — Android's native crop editor that opens varies by
    // manufacturer and its confirm action isn't always reachable (e.g.
    // Samsung's can leave no visible way back to the app). The preview
    // below, with its own Retake/"Use this photo" step, already covers
    // confirming — the native crop step was redundant on top of it.
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      cameraType: ImagePicker.CameraType.front,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setLocalUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!localUri) return;
    setIsSaving(true);
    setError(null);
    try {
      const compressedUri = await compressForUpload(localUri);
      const url = await uploadPhoto(token!, compressedUri);
      const updated = await setMyPhoto(token!, url);
      setPhotoUrl(updated.photoUrl ?? url);
      navigation.replace('StaffHome');
    } catch (err) {
      setError(err instanceof Error ? translateError(err, t) : t('selfie.couldNotSave'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('selfie.title')}</Text>
      <Text style={styles.subtitle}>{t('selfie.subtitle')}</Text>

      <Pressable style={styles.tapArea} onPress={handleCapture} disabled={isSaving}>
        {localUri ? (
          <Image source={{ uri: localUri }} style={styles.preview} />
        ) : (
          <Text style={styles.placeholder}>{t('selfie.tapToTake')}</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {localUri && (
        <>
          <Pressable style={styles.retakeButton} onPress={handleCapture} disabled={isSaving}>
            <Text style={styles.retakeText}>{t('selfie.retake')}</Text>
          </Pressable>
          <Pressable style={[styles.saveButton, isSaving && styles.saveButtonBusy]} onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#1a1200" /> : <Text style={styles.saveText}>{t('selfie.useThisPhoto')}</Text>}
          </Pressable>
        </>
      )}
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  tapArea: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
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
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
  retakeButton: {
    marginTop: 24,
  },
  retakeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.brandOrange,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 16,
    minWidth: 200,
  },
  saveButtonBusy: {
    opacity: 0.7,
  },
  saveText: {
    color: '#1a1200',
    fontSize: 16,
    fontWeight: '700',
  },
});
