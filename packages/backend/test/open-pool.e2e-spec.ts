import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from './../src/app.module';
import { closeTestDb, resetDatabase } from './utils/db';

async function loginAs(app: INestApplication<App>, email: string): Promise<{ token: string; id: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(201);
  return { token: response.body.accessToken as string, id: response.body.user.id as string };
}

/** sellers_stock is the only category simple enough to seed directly in 'arrived' — every real category now goes straight to 'completed' at creation, see ReceptionsService.create(). */
async function seedArrivedReception(app: INestApplication<App>, palletCount: number): Promise<string> {
  const prisma = app.get(PrismaService);
  const id = randomUUID();
  await prisma.reception.create({
    data: { id, createdByUserId: 'seed-test-user', status: 'arrived', category: 'sellers_stock', palletCount, arrivedAt: new Date() },
  });
  return id;
}

async function seedPallet(app: INestApplication<App>, labelPhotoUrls: string[]): Promise<string> {
  const prisma = app.get(PrismaService);
  const id = randomUUID();
  await prisma.sellerStockPallet.create({
    data: {
      id,
      boxNumber: 'B-DISPATCH',
      sellerName: 'Acme Parts',
      weightKg: 80,
      overweightFlag: false,
      condition: 'good',
      conditionFlags: ['good'],
      damageEvidencePhotoUrls: [],
      labelPhotoUrls,
      status: 'put_away',
      createdByUserId: 'seed-test-user',
    },
  });
  return id;
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
      .send({ completionPhotoUrl: '/uploads/done.jpg', completionComment: 'Recounted, matches now' })
      .expect(201);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.completionPhotoUrl).toBe('/uploads/done.jpg');
    expect(completed.body.completionComment).toBe('Recounted, matches now');
  });

  it('requires completionPhotoUrl and completionComment to complete a task', async () => {
    const created = await request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Recount aisle 4' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({})
      .expect(400);
  });

  it('shows the admin-attached creation photo/comment to staff, and auto-pauses an active floor task on claim', async () => {
    await request(app.getHttpServer())
      .post('/floor-tasks/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'pick' })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Recount aisle 4',
        creationPhotoUrl: '/uploads/reference.jpg',
        creationComment: 'Discrepancy flagged by the last audit',
      })
      .expect(201);
    expect(created.body.creationPhotoUrl).toBe('/uploads/reference.jpg');
    expect(created.body.creationComment).toBe('Discrepancy flagged by the last audit');

    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const openFloorTask = await request(app.getHttpServer())
      .get('/floor-tasks/mine/open')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(openFloorTask.body.pausedAt).not.toBeNull();
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
      .send({ completionPhotoUrl: '/uploads/done.jpg', completionComment: 'Done' })
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

  it('lets Admin target a task at one staff member — only they can see or claim it', async () => {
    const management = await loginAs(app, 'management@warehousehq.dev');

    const created = await request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Recount aisle 4', targetUserId: staff.id })
      .expect(201);
    expect(created.body.targetUserId).toBe(staff.id);

    // Doesn't show up for someone it isn't targeted at...
    const managementOpen = await request(app.getHttpServer())
      .get('/open-pool-tasks/open')
      .set('Authorization', `Bearer ${management.token}`)
      .expect(200);
    expect(managementOpen.body.some((t: { id: string }) => t.id === created.body.id)).toBe(false);

    // ...and they can't claim it either, even by id.
    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(403);

    // It does show up for, and can be claimed by, the actual target.
    const staffOpen = await request(app.getHttpServer())
      .get('/open-pool-tasks/open')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(staffOpen.body.some((t: { id: string }) => t.id === created.body.id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
  });

  it('rejects a non-admin dispatching receptions or pallets as tasks', async () => {
    await request(app.getHttpServer())
      .post('/open-pool-tasks/dispatch-receptions')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ items: [{ id: randomUUID(), comment: 'Put away please' }] })
      .expect(403);

    await request(app.getHttpServer())
      .post('/open-pool-tasks/dispatch-pallets')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ items: [{ id: randomUUID(), comment: 'Go check this' }] })
      .expect(403);
  });

  it('dispatches a reception as a task — moves it out of "arrived", and completing the task completes the reception', async () => {
    const receptionId = await seedArrivedReception(app, 5);

    const dispatched = await request(app.getHttpServer())
      .post('/open-pool-tasks/dispatch-receptions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ items: [{ id: receptionId, comment: 'Stack in aisle 4, bay 2' }] })
      .expect(201);
    expect(dispatched.body).toEqual([{ id: receptionId, success: true }]);

    const afterDispatch = await request(app.getHttpServer())
      .get(`/receptions/${receptionId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(afterDispatch.body.status).toBe('ready_for_putaway');
    expect(afterDispatch.body.instructions).toBe('Stack in aisle 4, bay 2');

    const openTasks = await request(app.getHttpServer())
      .get('/open-pool-tasks/open')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    const task = openTasks.body.find((t: { sourceId: string }) => t.sourceId === receptionId);
    expect(task).toMatchObject({ sourceType: 'reception', creationComment: 'Stack in aisle 4, bay 2' });

    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${task.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${task.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ completionPhotoUrl: '/uploads/done.jpg', completionComment: 'Put away' })
      .expect(201);

    const afterComplete = await request(app.getHttpServer())
      .get(`/receptions/${receptionId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(afterComplete.body.status).toBe('completed');
  });

  it('dispatches a pallet as a task — carries its first photo automatically, and completing it never touches the pallet', async () => {
    const palletId = await seedPallet(app, ['/uploads/label-1.jpg', '/uploads/label-2.jpg']);

    const dispatched = await request(app.getHttpServer())
      .post('/open-pool-tasks/dispatch-pallets')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ items: [{ id: palletId, comment: 'Go recount this one' }] })
      .expect(201);
    expect(dispatched.body).toEqual([{ id: palletId, success: true }]);

    const openTasks = await request(app.getHttpServer())
      .get('/open-pool-tasks/open')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    const task = openTasks.body.find((t: { sourceId: string }) => t.sourceId === palletId);
    expect(task).toMatchObject({
      sourceType: 'seller_stock_pallet',
      creationComment: 'Go recount this one',
      creationPhotoUrl: '/uploads/label-1.jpg',
    });

    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${task.id}/claim`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/open-pool-tasks/${task.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ completionPhotoUrl: '/uploads/done.jpg', completionComment: 'Recounted' })
      .expect(201);

    const pallet = await request(app.getHttpServer())
      .get(`/seller-stock/${palletId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(pallet.body.status).toBe('put_away');
  });
});
