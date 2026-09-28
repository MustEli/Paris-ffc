import { useEffect, useRef } from 'react';

import { useAuthStore } from '../auth/authStore';
import { getOrCreateSocket } from './socket';

/**
 * Subscribes to one named real-time event for as long as both the
 * caller is mounted and the session is authenticated — safe to use from
 * any screen, independent of whether some other screen already created
 * the shared socket (see socket.ts's get-or-create). `handler` is kept
 * in a ref so callers can pass an inline function without it going
 * stale or re-subscribing the socket listener on every render.
 */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void): void {
  const token = useAuthStore((state) => state.token);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!token) return;
    const socket = getOrCreateSocket(token);
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [token, event]);
}
