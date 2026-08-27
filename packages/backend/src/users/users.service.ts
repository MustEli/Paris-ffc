import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type CreateUserDto } from './dto/create-user.dto';
import { type Role, type User } from './user.types';

/**
 * Backed by Postgres via Prisma now — was a TEMPORARY IN-MEMORY STORE
 * (see git history / docs/architecture.md) that reset on every server
 * restart. The 3 seeded dev accounts (prisma/seed-data.ts) are now just
 * initial data — Admin can create/remove real individual accounts on
 * top of them (see create/remove/changeRole).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    return user ?? undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ?? undefined;
  }

  async findAll(role?: Role): Promise<User[]> {
    return this.prisma.user.findMany({ where: role ? { role } : undefined });
  }

  async findOneOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * currentUserId gates this on the CALLER's own canCreateUsers flag —
   * a trial Admin account with that flag off can't create new users at
   * all, regardless of what they send. Normal accounts (the overwhelming
   * majority — canCreateUsers defaults true) are unaffected.
   */
  async create(dto: CreateUserDto, currentUserId: string): Promise<User> {
    const currentUser = await this.findOneOrThrow(currentUserId);
    if (!currentUser.canCreateUsers) {
      throw new ForbiddenException('Your account is not permitted to create new users during this trial.');
    }
    if (await this.findByEmail(dto.email)) {
      throw new ConflictException('A user with this email already exists');
    }
    return this.prisma.user.create({
      data: {
        id: randomUUID(),
        name: dto.name,
        email: dto.email,
        passwordHash: bcrypt.hashSync(dto.password, 10),
        role: dto.role,
        loginLimit: dto.loginLimit ?? null,
        canCreateUsers: dto.canCreateUsers ?? true,
      },
    });
  }

  /** Called once per successful login — see AuthService.login()'s trial-limit check. */
  async incrementLoginCount(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { loginCount: { increment: 1 } } });
  }

  /**
   * currentUserId guards against an admin locking everyone out:
   * can't remove yourself, and can't remove the last remaining admin
   * (even if it's someone else's account).
   */
  async remove(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new BadRequestException('Cannot remove your own account');
    }
    const user = await this.findOneOrThrow(id);
    if (user.role === 'admin' && (await this.findAll('admin')).length <= 1) {
      throw new BadRequestException('Cannot remove the last admin account');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  /** Same last-admin lockout guard as remove() — can't demote yourself away from admin if you're the only one. */
  async changeRole(id: string, role: Role, currentUserId: string): Promise<User> {
    const user = await this.findOneOrThrow(id);
    if (id === currentUserId && user.role === 'admin' && role !== 'admin' && (await this.findAll('admin')).length <= 1) {
      throw new BadRequestException('Cannot change your own role — you are the last admin');
    }
    return this.prisma.user.update({ where: { id }, data: { role } });
  }
}
