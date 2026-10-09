import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { type PalletSearchResult, type SearchResults, type TaskSearchResult } from './search.types';

const RESULTS_PER_CATEGORY = 5;

/**
 * Global header search — scoped to what the web dashboard can actually
 * land a result *on* today, not a general index of every record in the
 * system. Concretely, "Task ID" only ever matches:
 *   - Floor Task Logs that are still open (the Dashboard's "Floor
 *     Tasks — Live" section only ever shows open ones)
 *   - Open Pool Tasks and Directives in any status (their sections on
 *     Task Board already show full history)
 * Put-Away and Order-Prep tasks are deliberately NOT searchable yet —
 * Task Board only ever renders *unassigned* slots for those (derived,
 * no id of their own); once one is actually assigned it has a real id,
 * but nothing in this dashboard lists assigned/in-progress tasks
 * individually to land a search result on (Dashboard only shows
 * aggregate counts for them). Issue Reports aren't searchable either —
 * there's no admin page for them at all yet. All of this reflects what
 * exists today, not a permanent design; add the missing pages first if
 * this needs to widen.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string): Promise<SearchResults> {
    const q = query.trim();
    if (q.length < 2) {
      return { pallets: [], staff: [], tasks: [] };
    }

    const [pallets, palletsByIndex, staff, floorTasks, openPoolTasks, directives] = await Promise.all([
      this.prisma.sellerStockPallet.findMany({
        where: {
          OR: [
            { boxNumber: { contains: q, mode: 'insensitive' } },
            { sellerName: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: RESULTS_PER_CATEGORY,
      }),
      // "Pallet ID" means the human-readable "PLT-000001" index, not the
      // raw UUID — that's derived from `seq` at read time (see
      // SellerStockService's doc comment), not a real column, so it
      // needs a raw query rather than a normal `where` filter.
      this.prisma.$queryRaw<
        { id: string; seq: number; boxNumber: string; sellerName: string }[]
      >`SELECT id, seq, "boxNumber", "sellerName" FROM "SellerStockPallet" WHERE LPAD(seq::text, 6, '0') ILIKE ${'%' + q + '%'} ORDER BY seq DESC LIMIT ${RESULTS_PER_CATEGORY}`,
      this.prisma.user.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: RESULTS_PER_CATEGORY,
      }),
      this.prisma.floorTaskLog.findMany({
        where: { id: { contains: q, mode: 'insensitive' }, endedAt: null },
        take: RESULTS_PER_CATEGORY,
      }),
      this.prisma.openPoolTask.findMany({
        where: { id: { contains: q, mode: 'insensitive' } },
        take: RESULTS_PER_CATEGORY,
      }),
      this.prisma.directive.findMany({
        where: { id: { contains: q, mode: 'insensitive' } },
        take: RESULTS_PER_CATEGORY,
      }),
    ]);

    const tasks: TaskSearchResult[] = [
      ...floorTasks.map((t): TaskSearchResult => ({
        id: t.id,
        kind: 'floor_task',
        label: `Floor Task — ${t.category}`,
        destination: 'dashboard',
      })),
      ...openPoolTasks.map((t): TaskSearchResult => ({
        id: t.id,
        kind: 'open_pool',
        label: `Open Pool — ${t.title}`,
        destination: 'task-board',
      })),
      ...directives.map((d): TaskSearchResult => ({
        id: d.id,
        kind: 'directive',
        label: `Directive — ${d.message.slice(0, 40)}${d.message.length > 40 ? '…' : ''}`,
        destination: 'task-board',
      })),
    ].slice(0, RESULTS_PER_CATEGORY);

    const palletResults = new Map<string, PalletSearchResult>();
    for (const p of pallets) {
      palletResults.set(p.id, {
        id: p.id,
        palletIndex: `PLT-${String(p.seq).padStart(6, '0')}`,
        sellerName: p.sellerName,
        boxNumber: p.boxNumber,
      });
    }
    for (const p of palletsByIndex) {
      palletResults.set(p.id, {
        id: p.id,
        palletIndex: `PLT-${String(p.seq).padStart(6, '0')}`,
        sellerName: p.sellerName,
        boxNumber: p.boxNumber,
      });
    }

    return {
      pallets: [...palletResults.values()].slice(0, RESULTS_PER_CATEGORY),
      staff: staff.map((u) => ({ id: u.id, name: u.name, role: u.role })),
      tasks,
    };
  }
}
