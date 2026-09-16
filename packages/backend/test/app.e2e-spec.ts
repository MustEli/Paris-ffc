import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { closeTestDb, resetDatabase } from './utils/db';

// A second, raw Prisma client — only used to seed exact timestamps
// directly (bypassing the real-time HTTP endpoints), so break-allowance
// and heartbeat-staleness math can be checked precisely instead of
// racing the wall clock.
const rawPrisma = new PrismaClient();

describe('Warehouse HQ backend (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    await resetDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDb();
    await rawPrisma.$disconnect();
  });

  it('/ (GET) health check', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      status: 'ok',
      service: 'warehouse-hq-backend',
    });
  });

  it('rejects a bad login', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects shift routes without a token', () => {
    return request(app.getHttpServer()).get('/shifts/status').expect(401);
  });

  it('logs in, then starts, checks, and ends a shift', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);

    expect(loginResponse.body.user).toMatchObject({ email: 'staff@warehousehq.dev', role: 'staff' });
    const token = loginResponse.body.accessToken as string;
    const auth = `Bearer ${token}`;

    await request(app.getHttpServer())
      .get('/shifts/status')
      .set('Authorization', auth)
      .expect(200)
      .expect({
        active: false,
        shiftId: null,
        startedAt: null,
        onBreak: false,
        breakStartedAt: null,
        breakType: null,
        shortBreakUsedMs: 0,
        shortBreakRemainingMs: 20 * 60_000,
      });

    const startResponse = await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', auth)
      .expect(201);
    expect(startResponse.body.endedAt).toBeNull();

    // Starting again while already active is rejected.
    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', auth).expect(409);

    const statusResponse = await request(app.getHttpServer())
      .get('/shifts/status')
      .set('Authorization', auth)
      .expect(200);
    expect(statusResponse.body.active).toBe(true);

    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', auth).expect(201);

    // Ending again with nothing active is rejected.
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', auth).expect(404);
  });

  it('lets staff take a lunch break without touching the shift, and blocks invalid transitions', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);
    const auth = `Bearer ${loginResponse.body.accessToken}`;

    // Can't take a break with no active shift.
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'lunch' })
      .expect(404);

    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', auth).expect(201);

    const breakStart = await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'lunch' })
      .expect(201);
    expect(breakStart.body.endedAt).toBeNull();
    expect(breakStart.body.type).toBe('lunch');

    // Starting a second break while one is already open is rejected.
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'lunch' })
      .expect(409);

    const statusWhileOnBreak = await request(app.getHttpServer())
      .get('/shifts/status')
      .set('Authorization', auth)
      .expect(200);
    expect(statusWhileOnBreak.body).toMatchObject({ active: true, onBreak: true });
    expect(statusWhileOnBreak.body.breakStartedAt).not.toBeNull();

    await request(app.getHttpServer()).post('/shifts/break/end').set('Authorization', auth).expect(201);

    // Ending again with nothing open is rejected.
    await request(app.getHttpServer()).post('/shifts/break/end').set('Authorization', auth).expect(404);

    const statusAfterBreak = await request(app.getHttpServer())
      .get('/shifts/status')
      .set('Authorization', auth)
      .expect(200);
    // The shift itself was never touched by any of this.
    expect(statusAfterBreak.body).toMatchObject({ active: true, onBreak: false, breakStartedAt: null });

    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', auth).expect(201);
  });

  it('ending a shift while on break also closes the open break', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);
    const auth = `Bearer ${loginResponse.body.accessToken}`;

    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', auth).expect(201);
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'lunch' })
      .expect(201);
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', auth).expect(201);

    // No open break left to end — it was auto-closed when the shift ended.
    await request(app.getHttpServer()).post('/shifts/break/end').set('Authorization', auth).expect(404);
  });

  it('caps short-break time at 20 minutes cumulative per shift, but never affects the separate lunch-break allowance', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);
    const auth = `Bearer ${loginResponse.body.accessToken}`;

    const start = await request(app.getHttpServer()).post('/shifts/start').set('Authorization', auth).expect(201);
    const shiftId = start.body.id as string;

    // Seed a completed 20-minute short break directly — the full
    // allowance for this shift, used up in one sitting.
    await rawPrisma.break.create({
      data: {
        id: randomUUID(),
        shiftId,
        type: 'short',
        startedAt: new Date('2026-01-01T10:00:00.000Z'),
        endedAt: new Date('2026-01-01T10:20:00.000Z'),
      },
    });

    const status = await request(app.getHttpServer()).get('/shifts/status').set('Authorization', auth).expect(200);
    expect(status.body.shortBreakUsedMs).toBe(20 * 60_000);
    expect(status.body.shortBreakRemainingMs).toBe(0);

    // The allowance is used up — a new short break is refused.
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'short' })
      .expect(409);

    // Lunch is a completely separate allowance — still available.
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'lunch' })
      .expect(201);
  });

  it('lunch and short breaks are mutually exclusive — only one open break at a time, regardless of type', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);
    const auth = `Bearer ${loginResponse.body.accessToken}`;

    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', auth).expect(201);

    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'lunch' })
      .expect(201);
    // Can't start a short break while lunch is still open.
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'short' })
      .expect(409);

    await request(app.getHttpServer()).post('/shifts/break/end').set('Authorization', auth).expect(201);

    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'short' })
      .expect(201);
    // Can't start a lunch break while short is still open.
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', auth)
      .send({ type: 'lunch' })
      .expect(409);
  });

  it('sends a heartbeat that keeps a shift alive', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);
    const auth = `Bearer ${loginResponse.body.accessToken}`;

    const start = await request(app.getHttpServer()).post('/shifts/start').set('Authorization', auth).expect(201);
    const shiftId = start.body.id as string;

    await request(app.getHttpServer()).post('/shifts/heartbeat').set('Authorization', auth).expect(201);

    const shift = await rawPrisma.shift.findUniqueOrThrow({ where: { id: shiftId } });
    expect(shift.lastHeartbeatAt).not.toBeNull();
    expect(shift.lastHeartbeatAt!.getTime()).toBeGreaterThanOrEqual(shift.startedAt.getTime());
  });

  it('auto-ends a shift whose heartbeat has gone stale, the next time anything checks its status', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);
    const auth = `Bearer ${loginResponse.body.accessToken}`;
    const userId = loginResponse.body.user.id as string;

    // Seeded directly with a heartbeat 40 minutes old — well past the
    // 30-minute tolerance — standing in for "the app was closed and
    // never sent another heartbeat."
    const lastSignal = new Date(Date.now() - 40 * 60_000);
    const shift = await rawPrisma.shift.create({
      data: { id: randomUUID(), userId, startedAt: lastSignal, endedAt: null, lastHeartbeatAt: lastSignal },
    });

    const status = await request(app.getHttpServer()).get('/shifts/status').set('Authorization', auth).expect(200);
    expect(status.body.active).toBe(false);

    const reloaded = await rawPrisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(reloaded.endedAt).not.toBeNull();
    // Ended as of the last real signal, not "now" — see
    // ShiftsService.getEffectiveActiveShift()'s doc comment for why.
    expect(reloaded.endedAt!.getTime()).toBe(lastSignal.getTime());
  });
});
