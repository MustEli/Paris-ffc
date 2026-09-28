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

describe('Directives (e2e)', () => {
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

  it('rejects a non-admin pushing a directive', () => {
    return request(app.getHttpServer())
      .post('/directives')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ type: 'verify_location', message: 'Check aisle 4', targetUserId: staff.id })
      .expect(403);
  });

  it('runs the targeted happy path: push -> acknowledge -> resolve', async () => {
    const pushed = await request(app.getHttpServer())
      .post('/directives')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ type: 'verify_location', message: 'Check aisle 4, rack 3', targetUserId: staff.id })
      .expect(201);
    expect(pushed.body.status).toBe('pushed');
    expect(pushed.body.targetUserId).toBe(staff.id);

    const mine = await request(app.getHttpServer())
      .get('/directives/mine')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(mine.body.some((d: { id: string }) => d.id === pushed.body.id)).toBe(true);

    const acknowledged = await request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/acknowledge`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(acknowledged.body.status).toBe('in_progress');
    expect(acknowledged.body.receivedByUserId).toBe(staff.id);

    const resolved = await request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/resolve`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({})
      .expect(201);
    expect(resolved.body.status).toBe('resolved');
  });

  it('requires a photoUrl to resolve a photo_demand directive', async () => {
    const pushed = await request(app.getHttpServer())
      .post('/directives')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ type: 'photo_demand', message: 'Photo of missing item', targetUserId: staff.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/acknowledge`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/resolve`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({})
      .expect(400);

    const resolved = await request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/resolve`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ photoUrl: '/uploads/evidence.jpg' })
      .expect(201);
    expect(resolved.body.photoUrl).toBe('/uploads/evidence.jpg');
  });

  it('rejects a staff member acknowledging a directive targeted at someone else', async () => {
    const management = await loginAs(app, 'management@warehousehq.dev');

    const pushed = await request(app.getHttpServer())
      .post('/directives')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ type: 'verify_location', message: 'Check aisle 4', targetUserId: staff.id })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/acknowledge`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(403);
  });

  it('lets "anyone available" be claimed first-come-first-served', async () => {
    const pushed = await request(app.getHttpServer())
      .post('/directives')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ type: 'clear_stalled_task', message: 'Unblock rack 2' })
      .expect(201);
    expect(pushed.body.targetUserId).toBeNull();

    const acknowledged = await request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/acknowledge`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(acknowledged.body.receivedByUserId).toBe(staff.id);

    const management = await loginAs(app, 'management@warehousehq.dev');
    return request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/acknowledge`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(409);
  });

  it('rejects resolving a directive acknowledged by someone else', async () => {
    const pushed = await request(app.getHttpServer())
      .post('/directives')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ type: 'custom', message: 'Do the thing' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/acknowledge`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const management = await loginAs(app, 'management@warehousehq.dev');
    return request(app.getHttpServer())
      .post(`/directives/${pushed.body.id}/resolve`)
      .set('Authorization', `Bearer ${management.token}`)
      .send({})
      .expect(403);
  });
});
