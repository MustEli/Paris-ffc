import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { UsersService } from '../users/users.service';

/**
 * Foundation for every live feature the customer asked for (Admin
 * Directives, Open Pool task claims disappearing instantly from other
 * staff's screens, priority-interrupt pushes, break pre-warnings) — a
 * single socket.io server, joined into per-user and per-role rooms so
 * any other module can target "this one staff member" or "every admin"
 * without knowing anything about sockets itself (see realtime.service.ts).
 *
 * Deliberately NOT a move off Expo Go: this only delivers events while
 * the app is open and connected, same reach as the polling it replaces
 * — true background/closed-app push (FCM/APNs) is a separate, bigger
 * step not needed for anything asked for so far.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new Error('token subject does not resolve to a real user');
      }
      socket.data.userId = user.id;
      socket.data.role = user.role;
      await socket.join(`user:${user.id}`);
      await socket.join(`role:${user.role}`);
    } catch (err) {
      this.logger.warn(`Rejected socket connection: ${err instanceof Error ? err.message : String(err)}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // No-op — socket.io removes the disconnected socket from every room automatically.
  }

  private extractToken(socket: Socket): string {
    const fromAuth = socket.handshake.auth?.token;
    const fromQuery = socket.handshake.query?.token;
    const token = typeof fromAuth === 'string' ? fromAuth : typeof fromQuery === 'string' ? fromQuery : null;
    if (!token) {
      throw new Error('no token provided in handshake');
    }
    return token;
  }
}
