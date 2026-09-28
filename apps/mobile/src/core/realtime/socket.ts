import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL } from '../api/client';

/**
 * One shared socket for the whole app session — every feature that
 * needs a live event (schedule pre-warnings today; Admin Directives,
 * Open Pool claim broadcasts, priority interrupts later) reuses this
 * same connection via useSocketEvent rather than opening its own.
 * Idempotent per token: repeated calls with the same token are a no-op,
 * so any screen can safely call this without caring whether some other
 * screen already did.
 */
let socket: Socket | null = null;
let socketToken: string | null = null;

export function getOrCreateSocket(token: string): Socket {
  if (socket && socketToken === token) {
    return socket;
  }
  socket?.disconnect();
  socket = io(API_BASE_URL, { auth: { token }, transports: ['websocket'] });
  socketToken = token;
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
