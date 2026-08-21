import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolvePhotoUrl } from '../../../core/api/upload';
import { MAX_PHOTOS_PER_FIELD } from '../types';
import { PhotoCaptureButton } from './PhotoCaptureButton';

interface Props {
  label: string;
  photos: string[]; // relative URLs already uploaded
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

/**
 * Take-many-photos control: shows a capture button (hidden once the cap
 * is hit) plus a scrollable strip of what's been taken so far, each
 * removable. Used for both the label photo and damage evidence — the
 * doc's "photo evidence" (plural) and a user request to allow more than
 * one shot of the label too, since a single photo isn't always enough.
 */
export function MultiPhotoCapture({ label, photos, onChange, maxPhotos = MAX_PHOTOS_PER_FIELD }: Props) {
  const atMax = photos.length >= maxPhotos;

  function addPhoto(url: string) {
    onChange([...photos, url]);
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <View>
      {atMax ? (
        <Text style={styles.maxReached}>
          {label} — maximum {maxPhotos} photos reached
        </Text>
      ) : (
        <PhotoCaptureButton
          label={photos.length > 0 ? `${label} (${photos.length}/${maxPhotos})` : label}
          value={null}
          onChange={addPhoto}
        />
      )}

      {photos.length > 0 && (
        <ScrollView horizontal style={styles.row} showsHorizontalScrollIndicator={false}>
          {photos.map((url, index) => (
            <Pressable key={url} style={styles.thumbWrapper} onPress={() => removePhoto(index)}>
              <Image source={{ uri: resolvePhotoUrl(url) }} style={styles.thumb} />
              <Text style={styles.remove}>✕ remove</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  maxReached: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  row: {
    marginTop: 10,
  },
  thumbWrapper: {
    marginRight: 10,
    alignItems: 'center',
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  remove: {
    fontSize: 10,
    color: '#dc2626',
    marginTop: 2,
  },
});
