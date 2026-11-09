import { API_BASE_URL, ApiError } from './client';

/** Separate from apiRequest() because this sends multipart/form-data, not JSON — mirrors apps/mobile's core/api/upload.ts. */
export async function uploadPhoto(token: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new ApiError(0, `Upload request failed (${detail}) — target was ${API_BASE_URL}/uploads`);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? `Upload failed with status ${response.status}`);
  }

  return (payload as { url: string }).url;
}

/** Mirrors apps/mobile's resolvePhotoUrl — a relative "/uploads/xyz.jpg" needs the API base prefixed on; an already-absolute Cloudinary URL must pass through as-is. */
export function resolvePhotoUrl(url: string): string {
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}
