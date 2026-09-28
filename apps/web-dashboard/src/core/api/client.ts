import { TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT, USER_STORAGE_KEY } from '../auth/storageKeys';

/**
 * Mirrors apps/mobile/src/core/api/client.ts's shape (ApiError, apiRequest)
 * so the same mental model applies on both clients — this one just
 * resolves its base URL Vite's way instead of Expo's, and the mobile
 * app's "derive the dev-machine LAN IP" trick doesn't apply here (a
 * browser tab always reaches whatever VITE_API_BASE_URL points at
 * directly, dev or prod).
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new ApiError(0, `Request failed (${detail}) — target was ${API_BASE_URL}${path}`);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `Request failed with status ${response.status}`;

    // Only a request that WAS authenticated (had a token) counts as a
    // session going stale — a failed login attempt also comes back 401
    // but has no token, and that's an expected error the Login page
    // already shows inline, not a reason to also wipe storage/redirect.
    if (response.status === 401 && options.token) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    throw new ApiError(response.status, message);
  }

  return payload as T;
}
