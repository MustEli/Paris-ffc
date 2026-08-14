import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { resolvePhotoUrl, uploadPhoto } from '../../../core/api/upload';
import { useAuthStore } from '../../../core/auth/authStore';

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
  const token = useAuthStore((state) => state.token);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required to take this photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;

    setIsUploading(true);
    try {
      const url = await uploadPhoto(token!, result.assets[0].uri);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.tapArea} onPress={handleCapture} disabled={isUploading}>
        {isUploading ? (
          <ActivityIndicator />
        ) : value ? (
          <Image source={{ uri: resolvePhotoUrl(value) }} style={styles.thumbnail} />
        ) : (
          <Text style={styles.placeholder}>📷 Tap to take photo</Text>
        )}
      </Pressable>
      {value && !isUploading && <Text style={styles.retake}>Tap to retake</Text>}
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
    color: '#374151',
    marginBottom: 6,
  },
  tapArea: {
    height: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  placeholder: {
    color: '#9ca3af',
    fontSize: 14,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  retake: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
});
