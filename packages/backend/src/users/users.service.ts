import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { type User } from './user.types';

/**
 * TEMPORARY IN-MEMORY STORE.
 * Just enough of a "domain model" to unblock the Attendance vertical
 * slice (see docs/architecture.md build roadmap, step 3) — no database
 * yet. Resets on every server restart. Swap for a real Postgres-backed
 * repository once persistence-across-restarts actually matters (roadmap
 * step 5+); the seeded dev accounts below exist purely for local testing.
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
}
