import * as bcrypt from 'bcryptjs';

/**
 * The 3 dev accounts that used to be hardcoded into UsersService's
 * in-memory array (see docs/architecture.md, "User account model").
 * They're still just initial/test data, not a hard limit — Admin can
 * create real individual accounts on top of these (userManagement
 * feature). Shared between prisma/seed.ts (dev DB bootstrap) and
 * test/utils/db.ts (reset before every e2e test) so both stay in sync.
 */
export const SEED_PASSWORD = 'password123';

export const SEED_USERS = [
  { id: 'u-staff-1', name: 'Sam Staff', email: 'staff@warehousehq.dev', role: 'staff' as const },
  { id: 'u-admin-1', name: 'Alex Admin', email: 'admin@warehousehq.dev', role: 'admin' as const },
  { id: 'u-management-1', name: 'Morgan Management', email: 'management@warehousehq.dev', role: 'management' as const },
];

export function seedPasswordHash(): string {
  return bcrypt.hashSync(SEED_PASSWORD, 10);
}
