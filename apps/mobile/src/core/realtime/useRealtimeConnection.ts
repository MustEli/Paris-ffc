import { useEffect } from 'react';

import { useAuthStore } from '../auth/authStore';
import { disconnectSocket } from './socket';

/**
 * Mounted once at the app root (RootNavigator) — the single place that
 * guarantees the shared socket is torn down on logout, regardless of
 * which screens happen to be mounted at that moment. Doesn't need to
 * *create* the socket itself — useSocketEvent's get-or-create already
 * does that lazily wherever it's first used — this only owns cleanup.
 */
export function useRealtimeConnection(): void {
  const token = useAuthStore((state) => state.token);
  useEffect(() => {
    if (!token) {
      disconnectSocket();
    }
  }, [token]);
}
