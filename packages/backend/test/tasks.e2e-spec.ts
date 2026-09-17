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

async function createReadyPallet(app: INestApplication<App>, staffToken: string): Promise<string> {
  const photo1 = await request(app.getHttpServer())
    .post('/uploads')
    .set('Authorization', `Bearer ${staffToken}`)
    .attach('file', Buffer.from('fake-image-bytes'), 'label.jpg')
    .expect(201);
  const photo2 = await request(app.getHttpServer())
    .post('/uploads')
    .set('Authorization', `Bearer ${staffToken}`)
    .attach('file', Buffer.from('fake-image-bytes-2'), 'box.jpg')
    .expect(201);

  const pallet = await request(app.getHttpServer())
    .post('/seller-stock')
    .set('Authorization', `Bearer ${staffToken}`)
    .send({
      labelPhotoUrls: [photo1.body.url, photo2.body.url],
      boxNumber: 'B-200',
      sellerName: 'Board Test Seller',
      weightKg: 50,
      condition: 'good',
    })
    .expect(201);
  return pallet.body.id as string;
}

describe('Task Board (e2e)', () => {
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
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('rejects staff from viewing the board', () => {
    return request(app.getHttpServer())
      .get('/tasks/board')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);
  });

  it('lists on-shift staff and excludes staff who have not started a shift', async () => {
    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', `Bearer ${staff.token}`).expect(201);

    const board = await request(app.getHttpServer())
      .get('/tasks/board')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(board.body.onShiftStaff.some((s: { userId: string }) => s.userId === staff.id)).toBe(true);
    expect(board.body.onShiftStaff[0].shiftStartedAt).toBeTruthy();
  });

  it('does not list staff without an active shift', async () => {
    const board = await request(app.getHttpServer())
      .get('/tasks/board')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(board.body.onShiftStaff).toHaveLength(0);
  });

  it('lists a ready pallet as a pending put-away item until it is assigned', async () => {
    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', `Bearer ${staff.token}`).expect(201);
    const palletId = await createReadyPallet(app, staff.token);

    const before = await request(app.getHttpServer())
      .get('/tasks/board')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const pendingBefore = before.body.pendingItems.filter(
      (i: { type: string; palletId?: string }) => i.type === 'put_away' && i.palletId === palletId,
    );
    expect(pendingBefore).toHaveLength(1);
    expect(pendingBefore[0].status).toBe('ready_for_putaway');

    await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 5' })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/tasks/board')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const pendingAfter = after.body.pendingItems.filter(
      (i: { type: string; palletId?: string }) => i.type === 'put_away' && i.palletId === palletId,
    );
    expect(pendingAfter).toHaveLength(0);
  });

  it('lists one pending order-prep item per unfilled picker/packer slot, shrinking as they are assigned', async () => {
    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', `Bearer ${staff.token}`).expect(201);
    const session = await request(app.getHttpServer())
      .post('/order-prep/sessions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ totalParts: 350 }) // 2 pickers, 3 packers needed
      .expect(201);

    const before = await request(app.getHttpServer())
      .get('/tasks/board')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const pickerSlotsBefore = before.body.pendingItems.filter(
      (i: { type: string; sessionId?: string; role?: string }) =>
        i.type === 'order_prep' && i.sessionId === session.body.id && i.role === 'picker',
    );
    const packerSlotsBefore = before.body.pendingItems.filter(
      (i: { type: string; sessionId?: string; role?: string }) =>
        i.type === 'order_prep' && i.sessionId === session.body.id && i.role === 'packer',
    );
    expect(pickerSlotsBefore).toHaveLength(2);
    expect(packerSlotsBefore).toHaveLength(3);

    await request(app.getHttpServer())
      .post(`/order-prep/sessions/${session.body.id}/tasks`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, role: 'picker' })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/tasks/board')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const pickerSlotsAfter = after.body.pendingItems.filter(
      (i: { type: string; sessionId?: string; role?: string }) =>
        i.type === 'order_prep' && i.sessionId === session.body.id && i.role === 'picker',
    );
    expect(pickerSlotsAfter).toHaveLength(1);
  });
});
