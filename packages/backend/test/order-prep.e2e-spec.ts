import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { closeTestDb, resetDatabase } from './utils/db';

async function loginAs(app: INestApplication<App>, email: string): Promise<{ token: string; id: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(201);
  return { token: response.body.accessToken as string, id: response.body.user.id as string };
}

describe('Order Prep (e2e)', () => {
  let app: INestApplication<App>;
  let staff: { token: string; id: string };
  let admin: { token: string; id: string };

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

    // ActiveShiftGuard: Staff can't use this controller at all without an
    // active shift. Every existing test here acts as Staff, so start one
    // globally rather than repeating it in each test.
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('rejects a non-admin creating a session', () => {
    return request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ totalParts: 350 })
      .expect(403);
  });

  it('computes pickers/packers/delay from total parts', async () => {
    const created = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 350 })
      .expect(201);

    // 350 parts / (25 parts/hr * 7hr shift) = 2 pickers.
    // 350 parts / (20 parts/hr * 7hr shift) = 3 packers (ceil(2.5)).
    expect(created.body.pickersNeeded).toBe(2);
    expect(created.body.packersNeeded).toBe(3);
    expect(created.body.packingDelayMinutes).toBeGreaterThan(0);
    expect(created.body.pickingStartedAt).toBeNull();
  });

  it('rejects assigning a task to a non-staff user', async () => {
    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 100 })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: admin.id, role: 'picker' })
      .expect(400);
  });

  it('accepts priority and instructions at assignment time, defaulting priority to normal when omitted', async () => {
    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 100 })
      .expect(201);

    const withPriority = await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'picker', priority: 'high', instructions: 'Rush order' })
      .expect(201);
    expect(withPriority.body.priority).toBe('high');
    expect(withPriority.body.instructions).toBe('Rush order');

    const withoutPriority = await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'packer' })
      .expect(201);
    expect(withoutPriority.body.priority).toBe('normal');
    expect(withoutPriority.body.instructions).toBeNull();
  });

  it('rejects a packer starting before the computed delay has passed', async () => {
    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 350 })
      .expect(201);

    const pickerTask = await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'picker' })
      .expect(201);
    const packerTask = await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'packer' })
      .expect(201);

    // Packer can't start before any picker has even started.
    await request(app.getHttpServer())
      .post(`/order-prep/tasks/${packerTask.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);

    await request(app.getHttpServer())
      .post(`/order-prep/tasks/${pickerTask.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    // Picking just started — still inside the packing-delay buffer window.
    await request(app.getHttpServer())
      .post(`/order-prep/tasks/${packerTask.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);

    const sessionAfter = await request(app.getHttpServer())
      .get(`/order-prep/sessions/${session.body.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(sessionAfter.body.pickingStartedAt).not.toBeNull();
    expect(sessionAfter.body.tasks).toHaveLength(2);
  });

  it('runs the picker happy path: assign → start → complete, computing duration', async () => {
    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 100 })
      .expect(201);

    const task = await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'picker' })
      .expect(201);
    expect(task.body.status).toBe('assigned');

    const started = await request(app.getHttpServer())
      .post(`/order-prep/tasks/${task.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(started.body.status).toBe('in_progress');

    const completed = await request(app.getHttpServer())
      .post(`/order-prep/tasks/${task.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects completing a task that was never started', async () => {
    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 100 })
      .expect(201);
    const task = await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'picker' })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/order-prep/tasks/${task.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);
  });

  it("rejects a staff member acting on someone else's task", async () => {
    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 100 })
      .expect(201);
    const task = await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'picker' })
      .expect(201);

    const management = await loginAs(app, 'management@warehousehq.dev');
    return request(app.getHttpServer())
      .post(`/order-prep/tasks/${task.body.id}/start`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(403);
  });

  it('staff only sees their own tasks; admin sees all', async () => {
    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 100 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'picker' })
      .expect(201);

    const staffView = await request(app.getHttpServer())
      .get('/order-prep/tasks')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(staffView.body.every((t: { assignedToUserId: string }) => t.assignedToUserId === staff.id)).toBe(
      true,
    );

    const adminView = await request(app.getHttpServer())
      .get('/order-prep/tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(adminView.body.length).toBeGreaterThanOrEqual(staffView.body.length);
  });

  it('blocks Staff from this controller entirely without an active shift, but never blocks Admin', async () => {
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', `Bearer ${staff.token}`).expect(201);

    await request(app.getHttpServer())
      .get('/order-prep/tasks')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);

    // Admin has no shift at all, ever — never gated by this.
    await request(app.getHttpServer())
      .get('/order-prep/tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
  });
});
