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

describe('Open Pool Tasks (e2e)', () => {
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

  it('rejects a non-admin creating an open pool task', () => {
    return request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ title: 'Recount aisle 4' })
      .expect(403);
  });

  it('runs the happy path: create -> appears in open list -> claim -> completes', async () => {
    const created = await request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Recount aisle 4', description: 'Discrepancy reported', priority: 'high' })
      .expect(201);
    expect(created.body.status).toBe('open');
    expect(created.body.claimedByUserId).toBeNull();

    const open = await request(app.getHttpServer())
      .get('/open-pool-tasks/open')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(open.body.some((t: { id: string }) => t.id === created.body.id)).toBe(true);

    const claimed = await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(claimed.body.status).toBe('claimed');
    expect(claimed.body.claimedByUserId).toBe(staff.id);

    const openAfterClaim = await request(app.getHttpServer())
      .get('/open-pool-tasks/open')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(openAfterClaim.body.some((t: { id: string }) => t.id === created.body.id)).toBe(false);

    const mine = await request(app.getHttpServer())
      .get('/open-pool-tasks/mine')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(mine.body.some((t: { id: string }) => t.id === created.body.id)).toBe(true);

    const completed = await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(completed.body.status).toBe('completed');
  });

  it('rejects a second claim on an already-claimed task (optimistic locking)', async () => {
    const created = await request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Recount aisle 4' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const management = await loginAs(app, 'management@warehousehq.dev');
    return request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(409);
  });

  it('rejects completing a task claimed by someone else', async () => {
    const created = await request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Recount aisle 4' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const management = await loginAs(app, 'management@warehousehq.dev');
    return request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(403);
  });

  it('blocks Staff from claiming without an active shift, but never blocks Admin from listing', async () => {
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', `Bearer ${staff.token}`).expect(201);

    const created = await request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Recount aisle 4' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
  });
});
