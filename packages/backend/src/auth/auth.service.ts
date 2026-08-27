import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { toPublicUser } from '../users/user.types';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash));

    if (!user || !passwordMatches) {
      // Same error either way — don't reveal whether the email exists.
      throw new UnauthorizedException('Invalid email or password');
    }

    // Trial-gating: loginLimit is null for every normal account (the
    // check is a no-op for them). Only set on accounts handed to an
    // evaluating company for a limited pilot. Checked after the password
    // check so a wrong-password attempt never consumes a login.
    if (user.loginLimit !== null && user.loginCount >= user.loginLimit) {
      throw new UnauthorizedException('Trial limit reached for this account — contact ELNO to continue.');
    }
    await this.usersService.incrementLoginCount(user.id);

    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: toPublicUser(user),
    };
  }
}
