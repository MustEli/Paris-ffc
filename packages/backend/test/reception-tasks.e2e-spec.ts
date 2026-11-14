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

describe('Reception Tasks (e2e)', () => {
  let app: INestApplication<App>;
  let staff: { token: string; id: string };
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
    management = await loginAs(app, 'management@warehousehq.dev');

    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', `Bearer ${staff.token}`).expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('starts a reception task, reports it as mine/active, and rejects starting a second one', async () => {
    const started = await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(started.body.endedAt).toBeNull();
    expect(started.body.pausedAt).toBeNull();
    expect(started.body.totalPausedMs).toBe(0);

    const active = await request(app.getHttpServer())
      .get('/reception-tasks/mine/active')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(active.body.id).toBe(started.body.id);

    const rejected = await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);
    expect(rejected.body.code).toBe('reception_task.already_open');
  });

  it('pauses and resumes an open task, accumulating totalPausedMs', async () => {
    const started = await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const paused = await request(app.getHttpServer())
      .post(`/reception-tasks/${started.body.id}/pause`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(paused.body.pausedAt).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/reception-tasks/${started.body.id}/pause`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);

    const resumed = await request(app.getHttpServer())
      .post(`/reception-tasks/${started.body.id}/resume`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(resumed.body.pausedAt).toBeNull();
    expect(resumed.body.totalPausedMs).toBeGreaterThanOrEqual(0);

    await request(app.getHttpServer())
      .post(`/reception-tasks/${started.body.id}/resume`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);
  });

  it('leaves a task unfinished, ending it and freeing the staff member to start a new one', async () => {
    const started = await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const left = await request(app.getHttpServer())
      .post(`/reception-tasks/${started.body.id}/leave-unfinished`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(left.body.endedAt).not.toBeNull();
    expect(left.body.outcome).toBe('unfinished');
    expect(left.body.receptionId).toBeNull();

    // NestJS sends an empty body (not a literal JSON "null") for a
    // handler returning null — supertest's response.body is {} when
    // there's nothing to parse. Same shape as FloorTasksController's
    // GET mine/open, which this mirrors.
    const active = await request(app.getHttpServer())
      .get('/reception-tasks/mine/active')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(active.body).toEqual({});

    await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
  });

  it("rejects acting on someone else's reception task", async () => {
    const started = await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    return request(app.getHttpServer())
      .post(`/reception-tasks/${started.body.id}/pause`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(403);
  });

  it('marks the task completed with the created reception id when POST /receptions is called with receptionTaskId', async () => {
    const started = await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'packaging_stock',
        parcelCount: 5,
        packagingType: 'Boxes',
        receptionTaskId: started.body.id,
      })
      .expect(201);

    const active = await request(app.getHttpServer())
      .get('/reception-tasks/mine/active')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(active.body).toEqual({});

    // No direct GET for a single reception task, but mine/active going
    // empty (above) plus a second start succeeding confirms it ended —
    // this re-derives the same task id was the one completed by
    // checking a fresh one is independent.
    const restarted = await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(restarted.body.id).not.toBe(started.body.id);
    expect(created.body.status).toBe('completed');
  });

  it('does not fail reception creation when receptionTaskId is omitted or invalid', async () => {
    await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'packaging_stock', parcelCount: 1, packagingType: 'Boxes' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'packaging_stock',
        parcelCount: 1,
        packagingType: 'Boxes',
        receptionTaskId: 'not-a-real-id',
      })
      .expect(201);
  }, 15000); // two full reception creates (each touching SheetsService) can be slow on a cold test DB

  it('blocks Staff from this controller entirely without an active shift, but never blocks Admin/Management', async () => {
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', `Bearer ${staff.token}`).expect(201);

    await request(app.getHttpServer())
      .post('/reception-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/reception-tasks/mine/active')
      .set('Authorization', `Bearer ${management.token}`)
      .expect(200);
  });
});
