/**
 * Lets api/client.ts announce "the session is no longer valid" without
 * importing authStore.ts directly — authStore.ts already imports
 * apiRequest from client.ts, so the reverse import would be circular.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitUnauthorized(): void {
  listeners.forEach((listener) => listener());
}
