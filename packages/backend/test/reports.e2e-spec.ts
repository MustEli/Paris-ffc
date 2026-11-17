import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { closeTestDb, resetDatabase } from './utils/db';

// A second, raw Prisma client — only used to seed a shift+break with
// exact, known timestamps directly (bypassing the real-time HTTP
// start/end endpoints), so break-time subtraction can be verified with
// deterministic numbers instead of racing the wall clock.
const rawPrisma = new PrismaClient();

async function loginAs(app: INestApplication<App>, email: string): Promise<{ token: string; id: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(201);
  return { token: response.body.accessToken as string, id: response.body.user.id as string };
}

async function uploadFakePhoto(app: INestApplication<App>, token: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/uploads')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from('fake-image-bytes'), 'label.jpg')
    .expect(201);
  return response.body.url as string;
}

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let staff: { token: string; id: string };
  let admin: { token: string; id: string };
  let management: { token: string; id: string };

  beforeEach(async () => {
    await resetDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    staff = await loginAs(app, 'staff@warehousehq.dev');
    admin = await loginAs(app, 'admin@warehousehq.dev');
    management = await loginAs(app, 'management@warehousehq.dev');
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDb();
    await rawPrisma.$disconnect();
  });

  it('rejects a staff member reading any report', async () => {
    for (const path of [
      'overview',
      'attendance',
      'staff-history',
      'reception',
      'reception-volume',
      'reception-duration',
      'seller-stock-quality',
      'reception-sources',
      'reception-reliability',
      'put-away',
      'order-prep',
      'admin-dashboard',
    ]) {
      await request(app.getHttpServer())
        .get(`/reports/${path}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(403);
    }
  });

  it('export-to-sheets is a safe no-op with no Google Sheets configured in this environment, admin/management only', async () => {
    await request(app.getHttpServer())
      .post('/reports/export-to-sheets')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/reports/export-to-sheets')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201)
      .expect({ success: true });

    await request(app.getHttpServer())
      .post('/reports/export-to-sheets')
      .set('Authorization', `Bearer ${management.token}`)
      .expect(201)
      .expect({ success: true });
  });

  it('overview reflects live counts, readable by both admin and management', async () => {
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const managementView = await request(app.getHttpServer())
      .get('/reports/overview')
      .set('Authorization', `Bearer ${management.token}`)
      .expect(200);
    expect(managementView.body.staffOnShiftCount).toBe(1);
    expect(managementView.body.totalStaffCount).toBe(1);
    expect(typeof managementView.body.generatedAt).toBe('string');

    const adminView = await request(app.getHttpServer())
      .get('/reports/overview')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(adminView.body.staffOnShiftCount).toBe(1);
  });

  it('attendance report aggregates only completed shifts, per staff member', async () => {
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    // Not ended yet — shouldn't count toward totalHoursWorked.
    let report = await request(app.getHttpServer())
      .get('/reports/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(report.body.rows).toHaveLength(0);

    await request(app.getHttpServer())
      .post('/shifts/end')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    report = await request(app.getHttpServer())
      .get('/reports/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(report.body.rows).toHaveLength(1);
    expect(report.body.rows[0]).toMatchObject({ userId: staff.id, userName: 'Sam Staff', totalShifts: 1 });
    expect(report.body.rows[0].totalHoursWorked).toBeGreaterThanOrEqual(0);
  });

  const ZERO_CUMULATIVE = {
    plannedHours: 0,
    actualHours: 0,
    floorTaskHours: 0,
    receptionHours: 0,
    openPoolHours: 0,
    urgentTaskHours: 0,
  };

  it('staff-history returns an empty day range when no shift has ever completed', async () => {
    const report = await request(app.getHttpServer())
      .get('/reports/staff-history')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(report.body.days).toEqual([]);
    expect(report.body.staff).toEqual([
      { userId: staff.id, userName: 'Sam Staff', days: {}, cumulative: ZERO_CUMULATIVE },
    ]);
  });

  it('staff-history computes planned (from schedule + working days) vs actual (net of lunch) per day', async () => {
    // 2026-01-01 is a Thursday.
    await request(app.getHttpServer())
      .put(`/schedules/${staff.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        shiftStartTime: '09:00',
        shiftEndTime: '16:30',
        requiredWorkingHours: 7,
        lunchBreakDurationMinutes: 30,
      })
      .expect(200);

    const shift = await rawPrisma.shift.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-01-01T09:00:00.000Z'),
        endedAt: new Date('2026-01-01T13:00:00.000Z'), // 4 hours later
      },
    });
    await rawPrisma.break.create({
      data: {
        id: randomUUID(),
        shiftId: shift.id,
        startedAt: new Date('2026-01-01T12:00:00.000Z'),
        endedAt: new Date('2026-01-01T12:30:00.000Z'), // 30 minutes
      },
    });

    const report = await request(app.getHttpServer())
      .get('/reports/staff-history')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(report.body.days[0]).toBe('2026-01-01');
    expect(report.body.days).toContain(new Date().toISOString().slice(0, 10));

    const staffRow = report.body.staff.find((r: { userId: string }) => r.userId === staff.id);
    // A working day with a 4h shift minus a 30-min lunch nets 3.5h actual, against the full 7h planned.
    // No Floor Task/Reception/Open Pool/Directive data was seeded here, so the 4 category breakdowns are all 0.
    expect(staffRow.days['2026-01-01']).toEqual({
      plannedHours: 7,
      actualHours: 3.5,
      floorTaskHours: 0,
      receptionHours: 0,
      openPoolHours: 0,
      urgentTaskHours: 0,
    });
    // 2026-01-04 is a Sunday — not in workingDays, so nothing is planned, and nothing was worked.
    expect(staffRow.days['2026-01-04']).toEqual({
      plannedHours: 0,
      actualHours: 0,
      floorTaskHours: 0,
      receptionHours: 0,
      openPoolHours: 0,
      urgentTaskHours: 0,
    });
    expect(staffRow.cumulative.actualHours).toBe(3.5);
    expect(staffRow.cumulative.plannedHours).toBeGreaterThan(0);
  });

  it('staff-history excludes a cancelled floor task from floorTaskHours (and its cumulative)', async () => {
    await rawPrisma.shift.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-02-02T08:00:00.000Z'),
        endedAt: new Date('2026-02-02T16:00:00.000Z'),
      },
    });
    await rawPrisma.floorTaskLog.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        category: 'pick',
        startedAt: new Date('2026-02-02T09:00:00.000Z'),
        endedAt: new Date('2026-02-02T10:00:00.000Z'), // 1h, but cancelled — must not count
        cancelledAt: new Date('2026-02-02T10:00:00.000Z'),
      },
    });

    const report = await request(app.getHttpServer())
      .get('/reports/staff-history')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const staffRow = report.body.staff.find((r: { userId: string }) => r.userId === staff.id);
    expect(staffRow.days['2026-02-02'].floorTaskHours).toBe(0);
    expect(staffRow.cumulative.floorTaskHours).toBe(0);
    // actualHours (clocked shift time) is unaffected by the cancel — it's a separate figure entirely.
    expect(staffRow.days['2026-02-02'].actualHours).toBe(8);
  });

  it('staff-history breaks down actual hours by category (Floor Task / Reception / Open Pool / Urgent Task) and sums a cumulative total', async () => {
    await rawPrisma.shift.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-02-02T08:00:00.000Z'),
        endedAt: new Date('2026-02-02T16:00:00.000Z'), // 8h, no break
      },
    });

    await rawPrisma.floorTaskLog.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        category: 'pick',
        startedAt: new Date('2026-02-02T09:00:00.000Z'),
        endedAt: new Date('2026-02-02T10:00:00.000Z'), // 1h
      },
    });

    await rawPrisma.receptionTask.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-02-02T10:00:00.000Z'),
        endedAt: new Date('2026-02-02T10:30:00.000Z'), // 30 min
        outcome: 'unfinished', // still counts as worked time even though no delivery was logged
      },
    });

    await rawPrisma.openPoolTask.create({
      data: {
        id: randomUUID(),
        title: 'Test task',
        createdByUserId: admin.id,
        claimedByUserId: staff.id,
        status: 'completed',
        claimedAt: new Date('2026-02-02T11:00:00.000Z'),
        completedAt: new Date('2026-02-02T11:45:00.000Z'), // 45 min
        completionPhotoUrl: '/uploads/x.jpg',
        completionComment: 'done',
      },
    });

    await rawPrisma.directive.create({
      data: {
        id: randomUUID(),
        issuerUserId: admin.id,
        type: 'custom',
        message: 'Go check this',
        status: 'resolved',
        receivedByUserId: staff.id,
        receivedAt: new Date('2026-02-02T12:00:00.000Z'),
        resolvedAt: new Date('2026-02-02T12:20:00.000Z'), // 20 min
        completionPhotoUrl: '/uploads/y.jpg',
        completionComment: 'checked',
      },
    });

    const report = await request(app.getHttpServer())
      .get('/reports/staff-history')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const staffRow = report.body.staff.find((r: { userId: string }) => r.userId === staff.id);
    const dayEntry = staffRow.days['2026-02-02'];
    expect(dayEntry.actualHours).toBe(8);
    expect(dayEntry.floorTaskHours).toBe(1);
    expect(dayEntry.receptionHours).toBe(0.5);
    expect(dayEntry.openPoolHours).toBe(0.75);
    expect(dayEntry.urgentTaskHours).toBe(0.33); // 20 min, rounded to 2 decimals

    expect(staffRow.cumulative.actualHours).toBe(8);
    expect(staffRow.cumulative.floorTaskHours).toBe(1);
    expect(staffRow.cumulative.receptionHours).toBe(0.5);
    expect(staffRow.cumulative.openPoolHours).toBe(0.75);
    expect(staffRow.cumulative.urgentTaskHours).toBe(0.33);
  });

  it('staff-activity "recent" lists each of the 4 finished-activity sources newest-first, including a completed Dispatch Floor Task\'s scannedBarcode', async () => {
    await rawPrisma.floorTaskLog.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        category: 'dispatch',
        startedAt: new Date('2026-02-02T09:00:00.000Z'),
        endedAt: new Date('2026-02-02T09:05:00.000Z'),
        scannedBarcode: 'ABC123',
      },
    });
    await rawPrisma.receptionTask.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-02-02T10:00:00.000Z'),
        endedAt: new Date('2026-02-02T10:30:00.000Z'),
        outcome: 'completed',
      },
    });
    await rawPrisma.openPoolTask.create({
      data: {
        id: randomUUID(),
        title: 'Test task',
        createdByUserId: admin.id,
        claimedByUserId: staff.id,
        status: 'completed',
        claimedAt: new Date('2026-02-02T11:00:00.000Z'),
        completedAt: new Date('2026-02-02T11:45:00.000Z'),
        completionPhotoUrl: '/uploads/x.jpg',
        completionComment: 'done',
      },
    });
    await rawPrisma.directive.create({
      data: {
        id: randomUUID(),
        issuerUserId: admin.id,
        type: 'custom',
        message: 'Go check this',
        status: 'resolved',
        receivedByUserId: staff.id,
        receivedAt: new Date('2026-02-02T12:00:00.000Z'),
        resolvedAt: new Date('2026-02-02T12:20:00.000Z'),
        completionPhotoUrl: '/uploads/y.jpg',
        completionComment: 'checked',
      },
    });

    const recent = await request(app.getHttpServer())
      .get('/reports/staff-activity?scope=recent')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(recent.body.entries).toHaveLength(4);
    // Newest-finished first: directive (12:20) -> open_pool (11:45) -> reception (10:30) -> floor_task (09:05).
    expect(recent.body.entries.map((e: { type: string }) => e.type)).toEqual([
      'directive',
      'open_pool',
      'reception',
      'floor_task',
    ]);
    const dispatchEntry = recent.body.entries.find((e: { type: string }) => e.type === 'floor_task');
    expect(dispatchEntry.floorTaskCategory).toBe('dispatch');
    expect(dispatchEntry.scannedBarcode).toBe('ABC123');
    expect(dispatchEntry.durationMs).toBe(5 * 60_000);

    await request(app.getHttpServer())
      .get('/reports/staff-activity?scope=recent')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);
  });

  it('staff-activity "live" lists in-progress rows only, oldest-started first, with null end/duration', async () => {
    await rawPrisma.floorTaskLog.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        category: 'pick',
        startedAt: new Date('2026-02-02T09:00:00.000Z'),
        endedAt: null,
      },
    });
    await rawPrisma.openPoolTask.create({
      data: {
        id: randomUUID(),
        title: 'Still open',
        createdByUserId: admin.id,
        claimedByUserId: staff.id,
        status: 'claimed',
        claimedAt: new Date('2026-02-02T10:00:00.000Z'),
      },
    });

    const live = await request(app.getHttpServer())
      .get('/reports/staff-activity')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(live.body.entries).toHaveLength(2);
    expect(live.body.entries.map((e: { type: string }) => e.type)).toEqual(['floor_task', 'open_pool']);
    for (const entry of live.body.entries) {
      expect(entry.endedAt).toBeNull();
      expect(entry.durationMs).toBeNull();
    }
  });

  it('staff-activity marks a cancelled Floor Task distinctly in "recent", excludes it from "live", and attaches hoursWorkedToday to every entry', async () => {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const shiftStart = new Date(startOfToday.getTime() + 8 * 3_600_000); // 08:00 UTC today
    const shiftEnd = new Date(startOfToday.getTime() + 16 * 3_600_000); // 16:00 UTC today — 8h, no break
    await rawPrisma.shift.create({
      data: { id: randomUUID(), userId: staff.id, startedAt: shiftStart, endedAt: shiftEnd },
    });

    // Cancelled 2+ minutes in (see FloorTasksService.cancel) — endedAt is set, cancelledAt is too.
    await rawPrisma.floorTaskLog.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        category: 'pick',
        startedAt: new Date('2026-02-02T09:00:00.000Z'),
        endedAt: new Date('2026-02-02T09:05:00.000Z'),
        cancelledAt: new Date('2026-02-02T09:05:00.000Z'),
      },
    });
    // A normal completed one too, so "recent" has something to contrast against.
    await rawPrisma.floorTaskLog.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        category: 'pack',
        startedAt: new Date('2026-02-02T10:00:00.000Z'),
        endedAt: new Date('2026-02-02T10:10:00.000Z'),
      },
    });

    const recent = await request(app.getHttpServer())
      .get('/reports/staff-activity?scope=recent')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(recent.body.entries).toHaveLength(2);
    const cancelledEntry = recent.body.entries.find((e: { floorTaskCategory: string }) => e.floorTaskCategory === 'pick');
    const completedEntry = recent.body.entries.find((e: { floorTaskCategory: string }) => e.floorTaskCategory === 'pack');
    expect(cancelledEntry.floorTaskOutcome).toBe('cancelled');
    expect(completedEntry.floorTaskOutcome).toBe('completed');
    // Both entries belong to the same staff member, clocked in for 8h today.
    expect(cancelledEntry.hoursWorkedToday).toBe(8);
    expect(completedEntry.hoursWorkedToday).toBe(8);

    // A cancelled task is always ended, so it never shows up in "live".
    const live = await request(app.getHttpServer())
      .get('/reports/staff-activity')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(live.body.entries).toHaveLength(0);
  });

  it('reception report breaks down by category, including flagged count', async () => {
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    // packaging_stock is created already completed (no admin instructions step) — see receptions.service.ts's create().
    await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'packaging_stock', parcelCount: 5, packagingType: 'Boxes', putAwayLocation: 'Zone B, Rack 1' })
      .expect(201);

    const report = await request(app.getHttpServer())
      .get('/reports/reception')
      .set('Authorization', `Bearer ${management.token}`)
      .expect(200);

    const packaging = report.body.categories.find((c: { category: string }) => c.category === 'packaging_stock');
    expect(packaging.totalCount).toBe(1);
    expect(packaging.completedCount).toBe(1);
    expect(packaging.averageProcessingMinutes).toBeGreaterThanOrEqual(0);
    expect(packaging.flaggedCount).toBe(0);

    const returns = report.body.categories.find((c: { category: string }) => c.category === 'return_parcels');
    expect(returns.totalCount).toBe(0);
    expect(returns.averageProcessingMinutes).toBeNull();
  });

  it('reception-volume totals deliveries by period/category and computes latest-vs-previous-period change', async () => {
    // 2026-03-02 is a Monday: 1 delivery. 2026-03-03 is a Tuesday: 2 deliveries (+100%).
    await rawPrisma.reception.create({
      data: {
        id: randomUUID(),
        createdByUserId: staff.id,
        status: 'completed',
        category: 'return_parcels',
        parcelCount: 3,
        transporterCompany: 'DHL',
        arrivedAt: new Date('2026-03-02T10:00:00.000Z'),
        putAwayAt: new Date('2026-03-02T10:00:00.000Z'),
        processingDurationMs: 0,
      },
    });
    await rawPrisma.reception.create({
      data: {
        id: randomUUID(),
        createdByUserId: staff.id,
        status: 'completed',
        category: 'return_parcels',
        parcelCount: 2,
        transporterCompany: 'DHL',
        arrivedAt: new Date('2026-03-03T10:00:00.000Z'),
        putAwayAt: new Date('2026-03-03T10:00:00.000Z'),
        processingDurationMs: 0,
      },
    });
    await rawPrisma.reception.create({
      data: {
        id: randomUUID(),
        createdByUserId: staff.id,
        status: 'completed',
        category: 'packaging_stock',
        parcelCount: 1,
        packagingType: 'Boxes',
        arrivedAt: new Date('2026-03-03T11:00:00.000Z'),
        putAwayAt: new Date('2026-03-03T11:00:00.000Z'),
        processingDurationMs: 0,
      },
    });

    const report = await request(app.getHttpServer())
      .get('/reports/reception-volume?granularity=day')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(report.body.granularity).toBe('day');
    const day1 = report.body.byPeriod.find((p: { period: string }) => p.period === '2026-03-02');
    const day2 = report.body.byPeriod.find((p: { period: string }) => p.period === '2026-03-03');
    expect(day1.total).toBe(1);
    expect(day2.total).toBe(2);
    expect(day2.byCategory.return_parcels).toBe(1);
    expect(day2.byCategory.packaging_stock).toBe(1);
    expect(report.body.percentChangeVsPreviousPeriod).toBe(100);
    const monday = report.body.byWeekday.find((w: { weekday: string }) => w.weekday === 'MON');
    expect(monday.total).toBe(1);
  });

  it('reception-duration averages ReceptionTask worked time by period/category/staff, completed outcomes only', async () => {
    const reception = await rawPrisma.reception.create({
      data: {
        id: randomUUID(),
        createdByUserId: staff.id,
        status: 'completed',
        category: 'packaging_stock',
        parcelCount: 1,
        packagingType: 'Boxes',
        arrivedAt: new Date('2026-03-02T09:30:00.000Z'),
        putAwayAt: new Date('2026-03-02T09:30:00.000Z'),
        processingDurationMs: 0,
      },
    });
    await rawPrisma.receptionTask.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-03-02T09:00:00.000Z'),
        endedAt: new Date('2026-03-02T09:30:00.000Z'), // 30 min
        outcome: 'completed',
        receptionId: reception.id,
      },
    });
    // Unfinished — must NOT count toward any average here.
    await rawPrisma.receptionTask.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-03-02T10:00:00.000Z'),
        endedAt: new Date('2026-03-02T10:10:00.000Z'),
        outcome: 'unfinished',
      },
    });

    const report = await request(app.getHttpServer())
      .get('/reports/reception-duration')
      .set('Authorization', `Bearer ${management.token}`)
      .expect(200);

    expect(report.body.byPeriod).toHaveLength(1);
    expect(report.body.byPeriod[0]).toMatchObject({ period: '2026-03-02', averageMinutes: 30, completedCount: 1 });
    const packaging = report.body.byCategory.find((c: { category: string }) => c.category === 'packaging_stock');
    expect(packaging).toMatchObject({ averageMinutes: 30, completedCount: 1 });
    const staffRow = report.body.byStaff.find((s: { userId: string }) => s.userId === staff.id);
    expect(staffRow).toMatchObject({ userName: 'Sam Staff', averageMinutes: 30, completedCount: 1 });
  });

  it('seller-stock-quality computes problem and overweight rates by seller/problem-type/period', async () => {
    await rawPrisma.sellerStockPallet.create({
      data: {
        id: randomUUID(),
        boxNumber: 'B-1',
        sellerName: 'Acme',
        weightKg: 100,
        overweightFlag: false,
        condition: 'good',
        conditionFlags: ['good'],
        labelPhotoUrls: ['/uploads/a.jpg'],
        damageEvidencePhotoUrls: [],
        status: 'put_away',
        createdByUserId: staff.id,
        createdAt: new Date('2026-03-02T09:00:00.000Z'),
        putAwayAt: new Date('2026-03-02T09:00:00.000Z'),
      },
    });
    await rawPrisma.sellerStockPallet.create({
      data: {
        id: randomUUID(),
        boxNumber: 'B-2',
        sellerName: 'Acme',
        weightKg: 750,
        overweightFlag: true,
        condition: 'damaged',
        conditionFlags: ['overweight', 'damaged'],
        damageRemarks: 'dented',
        labelPhotoUrls: ['/uploads/b.jpg'],
        damageEvidencePhotoUrls: ['/uploads/c.jpg'],
        status: 'pending_admin_review',
        createdByUserId: staff.id,
        createdAt: new Date('2026-03-02T09:30:00.000Z'),
      },
    });

    const report = await request(app.getHttpServer())
      .get('/reports/seller-stock-quality')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const acme = report.body.bySeller.find((s: { sellerName: string }) => s.sellerName === 'Acme');
    expect(acme).toMatchObject({ totalCount: 2, problemCount: 1, problemRatePercent: 50 });
    const damagedFlag = report.body.byProblemType.find((p: { flag: string }) => p.flag === 'damaged');
    expect(damagedFlag.count).toBe(1);
    const overweightFlag = report.body.byProblemType.find((p: { flag: string }) => p.flag === 'overweight');
    expect(overweightFlag.count).toBe(1);
    const acmeOverweight = report.body.overweight.bySeller.find((s: { sellerName: string }) => s.sellerName === 'Acme');
    expect(acmeOverweight).toMatchObject({ totalCount: 2, overweightCount: 1, overweightRatePercent: 50 });
  });

  it('reception-sources totals Return Parcels quantity by transporter company, by period', async () => {
    await rawPrisma.reception.create({
      data: {
        id: randomUUID(),
        createdByUserId: staff.id,
        status: 'completed',
        category: 'return_parcels',
        parcelCount: 5,
        transporterCompany: 'DHL',
        arrivedAt: new Date('2026-03-02T09:00:00.000Z'),
        putAwayAt: new Date('2026-03-02T09:00:00.000Z'),
        processingDurationMs: 0,
      },
    });
    await rawPrisma.reception.create({
      data: {
        id: randomUUID(),
        createdByUserId: staff.id,
        status: 'completed',
        category: 'return_parcels',
        parcelCount: 3,
        transporterCompany: 'UPS',
        arrivedAt: new Date('2026-03-02T09:30:00.000Z'),
        putAwayAt: new Date('2026-03-02T09:30:00.000Z'),
        processingDurationMs: 0,
      },
    });

    const report = await request(app.getHttpServer())
      .get('/reports/reception-sources')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(report.body.topTransporters).toEqual(
      expect.arrayContaining([
        { transporterCompany: 'DHL', totalQuantity: 5 },
        { transporterCompany: 'UPS', totalQuantity: 3 },
      ]),
    );
    const day = report.body.byPeriod.find((p: { period: string }) => p.period === '2026-03-02');
    expect(day.byTransporter).toEqual(
      expect.arrayContaining([
        { transporterCompany: 'DHL', quantity: 5 },
        { transporterCompany: 'UPS', quantity: 3 },
      ]),
    );
  });

  it('reception-reliability rates unfinished ReceptionTasks by period/staff', async () => {
    await rawPrisma.receptionTask.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-03-02T09:00:00.000Z'),
        endedAt: new Date('2026-03-02T09:10:00.000Z'),
        outcome: 'unfinished',
      },
    });
    await rawPrisma.receptionTask.create({
      data: {
        id: randomUUID(),
        userId: staff.id,
        startedAt: new Date('2026-03-02T09:30:00.000Z'),
        endedAt: new Date('2026-03-02T09:40:00.000Z'),
        outcome: 'completed',
      },
    });

    const report = await request(app.getHttpServer())
      .get('/reports/reception-reliability')
      .set('Authorization', `Bearer ${management.token}`)
      .expect(200);

    const day = report.body.byPeriod.find((p: { period: string }) => p.period === '2026-03-02');
    expect(day).toMatchObject({ unfinishedCount: 1, totalCount: 2, unfinishedRatePercent: 50 });
    const staffRow = report.body.byStaff.find((s: { userId: string }) => s.userId === staff.id);
    expect(staffRow).toMatchObject({ userName: 'Sam Staff', unfinishedCount: 1, totalCount: 2, unfinishedRatePercent: 50 });
  });

  it('put-away report counts tasks by outcome and averages completion time', async () => {
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const photoUrl1 = await uploadFakePhoto(app, staff.token);
    const photoUrl2 = await uploadFakePhoto(app, staff.token);
    const pallet = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        labelPhotoUrls: [photoUrl1, photoUrl2],
        boxNumber: 'B-1',
        sellerName: 'Acme',
        // Overweight so it lands in pending_admin_review and stays
        // assignable — a Good Condition, non-overweight pallet is
        // instant self-put-away now (see SellerStockService.create()),
        // never reaching a state Admin can assign a task against.
        weightKg: 750,
        conditionFlags: ['good'],
      })
      .expect(201);

    const task = await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId: pallet.body.id, assignedToUserId: staff.id, location: 'Aisle 2' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/put-away-tasks/${task.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/put-away-tasks/${task.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const report = await request(app.getHttpServer())
      .get('/reports/put-away')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(report.body.totalTasks).toBe(1);
    expect(report.body.completedCount).toBe(1);
    expect(report.body.issueReportedCount).toBe(0);
    expect(report.body.averageCompletionMinutes).toBeGreaterThanOrEqual(0);
  });

  it('order-prep report splits picker vs packer task stats', async () => {
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 50 })
      .expect(201);
    const pickerTask = await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'picker' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/order-prep/tasks/${pickerTask.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/order-prep/tasks/${pickerTask.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const report = await request(app.getHttpServer())
      .get('/reports/order-prep')
      .set('Authorization', `Bearer ${management.token}`)
      .expect(200);
    expect(report.body.totalSessions).toBe(1);
    expect(report.body.pickerTasks).toMatchObject({ totalCount: 1, completedCount: 1 });
    expect(report.body.pickerTasks.averageDurationMinutes).toBeGreaterThanOrEqual(0);
    expect(report.body.packerTasks).toMatchObject({
      totalCount: 0,
      completedCount: 0,
      averageDurationMinutes: null,
    });
  });

  it("admin dashboard reflects live state and today's activity, per staff member", async () => {
    // Live state: staff currently on shift.
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    // Today's activity: a completed reception and a completed put-away task.
    // equipment_other is created already completed (no admin instructions step) — see receptions.service.ts's create().
    await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'equipment_other',
        parcelCount: 3,
        itemDescription: 'Pallet racking',
        photoUrls: ['https://example.com/racking.jpg'],
        putAwayLocation: 'Zone D, Rack 3',
      })
      .expect(201);

    const photoUrl1 = await uploadFakePhoto(app, staff.token);
    const photoUrl2 = await uploadFakePhoto(app, staff.token);
    const pallet = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        labelPhotoUrls: [photoUrl1, photoUrl2],
        boxNumber: 'B-9',
        sellerName: 'Acme',
        // Overweight so it stays assignable — see the other pallet
        // creation above in this file for why.
        weightKg: 750,
        conditionFlags: ['good'],
      })
      .expect(201);
    const task = await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId: pallet.body.id, assignedToUserId: staff.id, location: 'Aisle 3' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/put-away-tasks/${task.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/put-away-tasks/${task.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const dashboard = await request(app.getHttpServer())
      .get('/reports/admin-dashboard')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(dashboard.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dashboard.body.liveSummary.staffOnShiftCount).toBe(1);
    expect(dashboard.body.today).toMatchObject({
      receptionsLoggedCount: 1,
      receptionsCompletedCount: 1,
      palletsLoggedCount: 1,
      putAwayCompletedCount: 1,
    });

    const staffRow = dashboard.body.staff.find((s: { userId: string }) => s.userId === staff.id);
    expect(staffRow).toMatchObject({
      userName: 'Sam Staff',
      onShift: true,
      putAwayCompletedToday: 1,
    });
    expect(staffRow.shiftStartedAt).not.toBeNull();
  });

  it("admin dashboard's per-staff status includes which break type and when it started, not just a bare onBreak flag", async () => {
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ type: 'short' })
      .expect(201);

    const dashboard = await request(app.getHttpServer())
      .get('/reports/admin-dashboard')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const staffRow = dashboard.body.staff.find((s: { userId: string }) => s.userId === staff.id);
    expect(staffRow.onBreak).toBe(true);
    expect(staffRow.breakType).toBe('short');
    expect(staffRow.breakStartedAt).not.toBeNull();
    expect(staffRow.shortBreakRemainingMs).toBeGreaterThan(0);
    expect(staffRow.shortBreakRemainingMs).toBeLessThanOrEqual(20 * 60_000);
    expect(staffRow.lunchBreakRemainingMs).toBeNull();
  });

  it("admin dashboard's per-staff status reports lunchBreakRemainingMs (a display target, not a real cap) while on a lunch break", async () => {
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ type: 'lunch' })
      .expect(201);

    const dashboard = await request(app.getHttpServer())
      .get('/reports/admin-dashboard')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const staffRow = dashboard.body.staff.find((s: { userId: string }) => s.userId === staff.id);
    expect(staffRow.breakType).toBe('lunch');
    expect(staffRow.lunchBreakRemainingMs).toBeGreaterThan(0);
    expect(staffRow.lunchBreakRemainingMs).toBeLessThanOrEqual(60 * 60_000);
    expect(staffRow.shortBreakRemainingMs).toBeNull();
  });

  it('excludes lunch break time from worked-hours totals', async () => {
    // Seeded directly with exact timestamps (bypassing the real-time
    // start/end endpoints) so the subtraction can be checked precisely:
    // a 4-hour shift with a 30-minute break in the middle should net
    // out to 3.5 hours worked, not 4.
    const shiftStart = new Date('2026-01-01T09:00:00.000Z');
    const shiftEnd = new Date('2026-01-01T13:00:00.000Z'); // 4 hours later
    const breakStart = new Date('2026-01-01T12:00:00.000Z');
    const breakEnd = new Date('2026-01-01T12:30:00.000Z'); // 30 minutes

    const shift = await rawPrisma.shift.create({
      data: { id: randomUUID(), userId: staff.id, startedAt: shiftStart, endedAt: shiftEnd },
    });
    await rawPrisma.break.create({
      data: { id: randomUUID(), shiftId: shift.id, startedAt: breakStart, endedAt: breakEnd },
    });

    const attendance = await request(app.getHttpServer())
      .get('/reports/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const staffRow = attendance.body.rows.find((r: { userId: string }) => r.userId === staff.id);
    expect(staffRow.totalHoursWorked).toBe(3.5);
  });

  it('does NOT exclude short-break time from worked-hours totals — it is paid', async () => {
    // Same 4-hour shift shape as the lunch-break test above, but with a
    // 20-minute *short* break instead — since that's paid time, the net
    // should come out to the full 4 hours, not 3.667.
    const shiftStart = new Date('2026-01-01T09:00:00.000Z');
    const shiftEnd = new Date('2026-01-01T13:00:00.000Z'); // 4 hours later
    const breakStart = new Date('2026-01-01T12:00:00.000Z');
    const breakEnd = new Date('2026-01-01T12:20:00.000Z'); // 20 minutes

    const shift = await rawPrisma.shift.create({
      data: { id: randomUUID(), userId: staff.id, startedAt: shiftStart, endedAt: shiftEnd },
    });
    await rawPrisma.break.create({
      data: { id: randomUUID(), shiftId: shift.id, type: 'short', startedAt: breakStart, endedAt: breakEnd },
    });

    const attendance = await request(app.getHttpServer())
      .get('/reports/attendance')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const staffRow = attendance.body.rows.find((r: { userId: string }) => r.userId === staff.id);
    expect(staffRow.totalHoursWorked).toBe(4);
  });
});
