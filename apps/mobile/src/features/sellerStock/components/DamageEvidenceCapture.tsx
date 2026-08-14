import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolvePhotoUrl } from '../../../core/api/upload';
import { PhotoCaptureButton } from './PhotoCaptureButton';

interface Props {
  photos: string[]; // relative URLs already uploaded
  onChange: (photos: string[]) => void;
}

/** Doc requires "mandatory photo evidence" (plural in the process-flow step) for damaged pallets — at least one, more allowed. */
export function DamageEvidenceCapture({ photos, onChange }: Props) {
  function addPhoto(url: string) {
    onChange([...photos, url]);
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <View>
      <PhotoCaptureButton label="Damage evidence photo" value={null} onChange={addPhoto} />

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
