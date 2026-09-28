import { Injectable } from '@nestjs/common';

import { type Role } from '../users/user.types';
import { RealtimeGateway } from './realtime.gateway';

/**
 * The only thing other modules should ever import from this module —
 * they emit a named event to a user or a role without knowing anything
 * about sockets/rooms. Silently a no-op if a target isn't currently
 * connected (same "best effort while the app is open" semantics as the
 * local-notification polling this is replacing).
 */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.gateway.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    for (const userId of userIds) {
      this.emitToUser(userId, event, payload);
    }
  }

  emitToRole(role: Role, event: string, payload: unknown): void {
    this.gateway.server.to(`role:${role}`).emit(event, payload);
  }
}
