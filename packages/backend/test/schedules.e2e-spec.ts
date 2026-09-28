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

const VALID_SCHEDULE = {
  workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  shiftStartTime: '07:30',
  shiftEndTime: '15:30',
  requiredWorkingHours: 7,
  paidBreakStartTime: '10:30',
  lunchBreakStartTime: '12:30',
  lunchBreakDurationMinutes: 60,
};

describe('Schedules (e2e)', () => {
  let app: INestApplication<App>;
  let admin: { token: string; id: string };
  let staff: { token: string; id: string };

  beforeEach(async () => {
    await resetDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    admin = await loginAs(app, 'admin@warehousehq.dev');
    staff = await loginAs(app, 'staff@warehousehq.dev');
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('returns an empty body for a staff member with no schedule configured yet', async () => {
    // Nest sends an empty body (not JSON "null") for a null return — the
    // web/mobile apiRequest clients already catch that as a JSON-parse
    // failure and treat it as null, so this is the real wire contract.
    const response = await request(app.getHttpServer())
      .get(`/schedules/${staff.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(response.text).toBe('');
  });

  it('rejects a non-admin setting a schedule', () => {
    return request(app.getHttpServer())
      .put(`/schedules/${staff.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send(VALID_SCHEDULE)
      .expect(403);
  });

  it('rejects setting a schedule for a non-staff user', () => {
    return request(app.getHttpServer())
      .put(`/schedules/${admin.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send(VALID_SCHEDULE)
      .expect(400);
  });

  it('rejects an invalid time format', () => {
    return request(app.getHttpServer())
      .put(`/schedules/${staff.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...VALID_SCHEDULE, shiftStartTime: '7:30am' })
      .expect(400);
  });

  it('rejects an invalid weekday', () => {
    return request(app.getHttpServer())
      .put(`/schedules/${staff.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...VALID_SCHEDULE, workingDays: ['MONDAY'] })
      .expect(400);
  });

  it('lets Admin set a schedule, and Staff reads it as their own', async () => {
    const set = await request(app.getHttpServer())
      .put(`/schedules/${staff.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send(VALID_SCHEDULE)
      .expect(200);
    expect(set.body).toMatchObject(VALID_SCHEDULE);

    const mine = await request(app.getHttpServer())
      .get('/schedules/me')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(mine.body).toMatchObject(VALID_SCHEDULE);
  });

  it('re-setting a schedule overwrites the previous one', async () => {
    await request(app.getHttpServer())
      .put(`/schedules/${staff.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send(VALID_SCHEDULE)
      .expect(200);

    const updated = await request(app.getHttpServer())
      .put(`/schedules/${staff.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ...VALID_SCHEDULE, shiftStartTime: '08:00', shiftEndTime: '16:00' })
      .expect(200);
    expect(updated.body.shiftStartTime).toBe('08:00');
    expect(updated.body.shiftEndTime).toBe('16:00');
  });
});
