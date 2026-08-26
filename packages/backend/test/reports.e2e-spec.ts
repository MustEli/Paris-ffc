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
    for (const path of ['overview', 'attendance', 'reception', 'put-away', 'order-prep', 'admin-dashboard']) {
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

  it('reception report breaks down by category, including flagged count', async () => {
    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'packaging_stock', parcelCount: 5, packagingType: 'Boxes' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/instructions`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ instructions: 'Aisle 1' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
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

  it('put-away report counts tasks by outcome and averages completion time', async () => {
    const photoUrl = await uploadFakePhoto(app, staff.token);
    const pallet = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ labelPhotoUrls: [photoUrl], boxNumber: 'B-1', sellerName: 'Acme', weightKg: 50, condition: 'good' })
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
    const reception = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'sellers_stock', palletCount: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/receptions/${reception.body.id}/instructions`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ instructions: 'Aisle 1' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/receptions/${reception.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const photoUrl = await uploadFakePhoto(app, staff.token);
    const pallet = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ labelPhotoUrls: [photoUrl], boxNumber: 'B-9', sellerName: 'Acme', weightKg: 40, condition: 'good' })
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
});
