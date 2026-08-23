import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

import { type CreateUserDto } from './dto/create-user.dto';
import { type Role, type User } from './user.types';

/**
 * TEMPORARY IN-MEMORY STORE.
 * Just enough of a "domain model" to unblock the Attendance vertical
 * slice (see docs/architecture.md build roadmap, step 3) — no database
 * yet. Resets on every server restart. Swap for a real Postgres-backed
 * repository once persistence-across-restarts actually matters (roadmap
 * step 5+); the seeded dev accounts below exist purely for local testing
 * and are now just the initial data — Admin can create/remove real
 * individual accounts on top of them (see create/remove/changeRole).
 */
const SEED_PASSWORD = 'password123';

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    {
      id: 'u-staff-1',
      name: 'Sam Staff',
      email: 'staff@warehousehq.dev',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: 'staff',
    },
    {
      id: 'u-admin-1',
      name: 'Alex Admin',
      email: 'admin@warehousehq.dev',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: 'admin',
    },
    {
      id: 'u-management-1',
      name: 'Morgan Management',
      email: 'management@warehousehq.dev',
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
      role: 'management',
    },
  ];

  findByEmail(email: string): User | undefined {
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  findById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  findAll(role?: Role): User[] {
    return role ? this.users.filter((user) => user.role === role) : [...this.users];
  }

  findOneOrThrow(id: string): User {
    const user = this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  create(dto: CreateUserDto): User {
    if (this.findByEmail(dto.email)) {
      throw new ConflictException('A user with this email already exists');
    }
    const user: User = {
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      role: dto.role,
    };
    this.users.push(user);
    return user;
  }

  /**
   * currentUserId guards against an admin locking everyone out:
   * can't remove yourself, and can't remove the last remaining admin
   * (even if it's someone else's account).
   */
  remove(id: string, currentUserId: string): void {
    if (id === currentUserId) {
      throw new BadRequestException('Cannot remove your own account');
    }
    const user = this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === 'admin' && this.findAll('admin').length <= 1) {
      throw new BadRequestException('Cannot remove the last admin account');
    }
    const index = this.users.indexOf(user);
    this.users.splice(index, 1);
  }

  /** Same last-admin lockout guard as remove() — can't demote yourself away from admin if you're the only one. */
  changeRole(id: string, role: Role, currentUserId: string): User {
    const user = this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (id === currentUserId && user.role === 'admin' && role !== 'admin' && this.findAll('admin').length <= 1) {
      throw new BadRequestException('Cannot change your own role — you are the last admin');
    }
    user.role = role;
    return user;
  }
}
