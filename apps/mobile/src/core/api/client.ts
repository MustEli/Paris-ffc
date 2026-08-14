import Constants from 'expo-constants';

const BACKEND_PORT = 3000;

/**
 * The backend runs on this dev machine, not the phone — so "localhost"
 * only works in a web/simulator context that shares the machine. On a
 * real device (Expo Go), we reuse the LAN IP Expo's own dev server is
 * already reachable at (Constants.expoConfig.hostUri, e.g.
 * "192.168.1.23:8081") and just swap the port. That IP is guaranteed
 * reachable already — it's how the phone got the JS bundle in the first
 * place — so there's no separate network configuration to get right.
 */
function resolveApiBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:${BACKEND_PORT}`;
  }
  return `http://localhost:${BACKEND_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

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
  token?: string;
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
  } catch {
    // Network-level failure (backend not running, wrong network, etc.) —
    // not something the backend itself returned, so no status code.
    throw new ApiError(0, `Could not reach the server at ${API_BASE_URL}. Is the backend running?`);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message: unknown }).message)
      : null) ?? `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}
