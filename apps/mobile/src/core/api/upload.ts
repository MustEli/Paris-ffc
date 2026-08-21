import { API_BASE_URL, ApiError } from './client';

/**
 * Separate from apiRequest() because this sends multipart/form-data, not
 * JSON — fetch sets the correct multipart boundary itself as long as we
 * don't set a Content-Type header manually.
 */
export async function uploadPhoto(token: string, localUri: string): Promise<string> {
  const filename = localUri.split('/').pop() ?? `photo-${Date.now()}.jpg`;
  const extensionMatch = /\.(\w+)$/.exec(filename);
  const mimeType = extensionMatch ? `image/${extensionMatch[1].toLowerCase()}` : 'image/jpeg';

  const formData = new FormData();
  // React Native's FormData accepts this { uri, name, type } shape for
  // files; it isn't a real Blob, hence the `as unknown as Blob` cast.
  formData.append('file', { uri: localUri, name: filename, type: mimeType } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  } catch (err) {
    // Surface the real underlying error instead of a blanket "unreachable"
    // message — React Native's fetch can throw for reasons other than a
    // dead server (bad FormData/file URI, request aborted, etc.), and
    // hiding that made this much harder to debug than it needed to be.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new ApiError(0, `Upload request failed (${detail}) — target was ${API_BASE_URL}/uploads`);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? `Upload failed with status ${response.status}`);
  }

  return (payload as { url: string }).url;
}

/** Turns the backend's relative "/uploads/xyz.jpg" into a URL the app can actually load. */
export function resolvePhotoUrl(relativeUrl: string): string {
  return `${API_BASE_URL}${relativeUrl}`;
}
