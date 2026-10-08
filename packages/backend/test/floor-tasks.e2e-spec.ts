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

describe('Floor Tasks (e2e)', () => {
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

  it('runs the pick happy path: start -> end with counts', async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);
    expect(started.body.category).toBe('pick');
    expect(started.body.endedAt).toBeNull();

    const ended = await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/end`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ count: 42, countExtra: 3 })
      .expect(201);
    expect(ended.body.count).toBe(42);
    expect(ended.body.countExtra).toBe(3);
    expect(ended.body.endedAt).not.toBeNull();
  });

  it('ends a count-required category even with no count given — Stop must always succeed', async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pack' })
      .expect(201);

    const ended = await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/end`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({})
      .expect(201);
    expect(ended.body.count).toBeNull();
    expect(ended.body.endedAt).not.toBeNull();
  });

  it('ends a warehousing task even with no zone given, and records one when given', async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'warehousing_inventory_check' })
      .expect(201);

    const ended = await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/end`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ count: 5, zone: 'Zone B - Rack 02', comment: 'All good' })
      .expect(201);
    expect(ended.body.zone).toBe('Zone B - Rack 02');
  });

  it('ends backup_other even with no comment given, and records one when given', async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'backup_other' })
      .expect(201);

    const ended = await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/end`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ comment: 'Cleaned up aisle 4' })
      .expect(201);
    expect(ended.body.comment).toBe('Cleaned up aisle 4');
  });

  it('pauses and resumes an open task, accumulating totalPausedMs', async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);
    expect(started.body.pausedAt).toBeNull();
    expect(started.body.totalPausedMs).toBe(0);

    const paused = await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/pause`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(paused.body.pausedAt).not.toBeNull();

    const resumed = await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/resume`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(resumed.body.pausedAt).toBeNull();
    expect(resumed.body.totalPausedMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects pausing an already-paused task, and resuming one that is not paused', async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/resume`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);

    await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/pause`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    return request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/pause`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);
  });

  it("rejects pausing someone else's open floor task", async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);

    const management = await loginAs(app, 'management@warehousehq.dev');
    return request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/pause`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(403);
  });

  it('allows ending a task while still paused, folding the open pause into totalPausedMs', async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/pause`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const ended = await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/end`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ count: 3 })
      .expect(201);
    expect(ended.body.pausedAt).toBeNull();
    expect(ended.body.totalPausedMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects starting a second floor task while one is already open', async () => {
    await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);

    return request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pack' })
      .expect(409);
  });

  it('rejects starting a floor task with the merged-away "box_prep" category', () => {
    return request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'box_prep' })
      .expect(400);
  });

  it("rejects a staff member ending someone else's floor task", async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);

    const management = await loginAs(app, 'management@warehousehq.dev');
    return request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/end`)
      .set('Authorization', `Bearer ${management.token}`)
      .send({ count: 1 })
      .expect(403);
  });

  it("lets Admin see the live active list with the staff member's name", async () => {
    const started = await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);

    const active = await request(app.getHttpServer())
      .get('/floor-tasks/active')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(active.body).toHaveLength(1);
    expect(active.body[0].id).toBe(started.body.id);
    expect(active.body[0].userName).toBe('Sam Staff');

    await request(app.getHttpServer())
      .post(`/floor-tasks/${started.body.id}/end`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ count: 1 })
      .expect(201);

    const afterEnd = await request(app.getHttpServer())
      .get('/floor-tasks/active')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(afterEnd.body).toHaveLength(0);
  });

  it('rejects a non-admin viewing the active list', () => {
    return request(app.getHttpServer())
      .get('/floor-tasks/active')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);
  });

  it('blocks Staff from this controller entirely without an active shift, but never blocks Admin', async () => {
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', `Bearer ${staff.token}`).expect(201);

    await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(403);

    await request(app.getHttpServer())
      .get('/floor-tasks/active')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
  });
});
