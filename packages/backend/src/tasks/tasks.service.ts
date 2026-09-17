import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { type OnShiftStaffMember, type PendingTaskItem, type TaskBoard } from './tasks.types';

/**
 * Backs the Task Board (web dashboard) — see the module doc comment on
 * tasks.types.ts for why "pending" items aren't a table of their own.
 */
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async board(): Promise<TaskBoard> {
    const [activeShifts, pendingPallets, sessions] = await Promise.all([
      this.prisma.shift.findMany({ where: { endedAt: null } }),
      this.prisma.sellerStockPallet.findMany({
        where: { status: { in: ['ready_for_putaway', 'pending_admin_review'] } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.orderPrepSession.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);

    const onShiftUserIds = activeShifts.map((s) => s.userId);
    const staffUsers = await this.prisma.user.findMany({
      where: { id: { in: onShiftUserIds }, role: 'staff' },
    });
    const shiftByUserId = new Map(activeShifts.map((s) => [s.userId, s]));
    const onShiftStaff: OnShiftStaffMember[] = staffUsers.map((u) => ({
      userId: u.id,
      userName: u.name,
      shiftStartedAt: shiftByUserId.get(u.id)!.startedAt.toISOString(),
    }));

    const activePutAwayTasks = await this.prisma.putAwayTask.findMany({
      where: { palletId: { in: pendingPallets.map((p) => p.id) }, status: { not: 'completed' } },
      select: { palletId: true },
    });
    const palletsWithActiveTask = new Set(activePutAwayTasks.map((t) => t.palletId));

    const pendingPutAway: PendingTaskItem[] = pendingPallets
      .filter((p) => !palletsWithActiveTask.has(p.id))
      .map((p) => ({
        type: 'put_away',
        palletId: p.id,
        palletIndex: `PLT-${String(p.seq).padStart(6, '0')}`,
        sellerName: p.sellerName,
        status: p.status as 'ready_for_putaway' | 'pending_admin_review',
        createdAt: p.createdAt.toISOString(),
      }));

    const orderPrepTasks = await this.prisma.orderPrepTask.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      select: { sessionId: true, role: true },
    });
    const assignedCountByKey = new Map<string, number>();
    for (const t of orderPrepTasks) {
      const key = `${t.sessionId}:${t.role}`;
      assignedCountByKey.set(key, (assignedCountByKey.get(key) ?? 0) + 1);
    }

    const pendingOrderPrep: PendingTaskItem[] = [];
    for (const session of sessions) {
      const pickersAssigned = assignedCountByKey.get(`${session.id}:picker`) ?? 0;
      const packersAssigned = assignedCountByKey.get(`${session.id}:packer`) ?? 0;
      for (let i = pickersAssigned; i < session.pickersNeeded; i++) {
        pendingOrderPrep.push({
          type: 'order_prep',
          sessionId: session.id,
          role: 'picker',
          totalParts: session.totalParts,
          createdAt: session.createdAt.toISOString(),
        });
      }
      for (let i = packersAssigned; i < session.packersNeeded; i++) {
        pendingOrderPrep.push({
          type: 'order_prep',
          sessionId: session.id,
          role: 'packer',
          totalParts: session.totalParts,
          createdAt: session.createdAt.toISOString(),
        });
      }
    }

    return {
      onShiftStaff,
      pendingItems: [...pendingPutAway, ...pendingOrderPrep],
    };
  }
}
