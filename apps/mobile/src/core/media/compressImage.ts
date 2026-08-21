import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.6;

/**
 * Full-resolution camera photos (often several MB at 12MP+) can fail to
 * upload through React Native's fetch/FormData bridge with a generic
 * "TypeError: Network request failed" — not an actual network problem,
 * just the file being too large for the bridge to handle. Resizing
 * (not just JPEG-quality compression, which doesn't touch dimensions)
 * fixes that, and is faster over a warehouse Wi-Fi/hotspot regardless.
 */
export async function compressForUpload(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}
