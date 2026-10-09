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

describe('Search (e2e)', () => {
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

  it('rejects a non-admin/management caller', () => {
    return request(app.getHttpServer())
      .get('/search')
      .query({ q: 'ab' })
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);
  });

  it('returns empty results for a query under 2 characters, without erroring', async () => {
    const response = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'a' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(response.body).toEqual({ pallets: [], staff: [], tasks: [] });
  });

  it('finds a pallet by its human-readable index, seller name, and box number', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .set('Authorization', `Bearer ${staff.token}`)
      .attach('file', Buffer.from('fake-image-bytes'), 'label.jpg')
      .expect(201);
    const photo = await request(app.getHttpServer())
      .post('/uploads')
      .set('Authorization', `Bearer ${staff.token}`)
      .attach('file', Buffer.from('fake-image-bytes'), 'label.jpg')
      .expect(201);

    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    const pallet = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        labelPhotoUrls: [photo.body.url, photo.body.url],
        boxNumber: 'B-SEARCHME',
        sellerName: 'Searchable Seller Co',
        weightKg: 50,
        conditionFlags: ['good'],
      })
      .expect(201);

    const byIndex = await request(app.getHttpServer())
      .get('/search')
      .query({ q: pallet.body.palletIndex.replace('PLT-', '') })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(byIndex.body.pallets.some((p: { id: string }) => p.id === pallet.body.id)).toBe(true);

    const bySeller = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'Searchable Seller' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(bySeller.body.pallets.some((p: { id: string }) => p.id === pallet.body.id)).toBe(true);

    const byBox = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'B-SEARCHME' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(byBox.body.pallets.some((p: { id: string }) => p.id === pallet.body.id)).toBe(true);
  });

  it('finds staff by name', async () => {
    const response = await request(app.getHttpServer())
      .get('/search')
      .query({ q: 'Sam Staff' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(response.body.staff.some((s: { id: string }) => s.id === staff.id)).toBe(true);
  });

  it('finds an open pool task by id, but not a put-away task that is already completed', async () => {
    const openPool = await request(app.getHttpServer())
      .post('/open-pool-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Recount aisle 9' })
      .expect(201);

    const foundOpenPool = await request(app.getHttpServer())
      .get('/search')
      .query({ q: openPool.body.id })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(foundOpenPool.body.tasks.some((t: { id: string }) => t.id === openPool.body.id)).toBe(true);

    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', `Bearer ${staff.token}`).expect(201);
    const photo = await request(app.getHttpServer())
      .post('/uploads')
      .set('Authorization', `Bearer ${staff.token}`)
      .attach('file', Buffer.from('fake-image-bytes'), 'label.jpg')
      .expect(201);
    const pallet = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        labelPhotoUrls: [photo.body.url, photo.body.url],
        boxNumber: 'B-DONE',
        sellerName: 'Done Seller',
        weightKg: 50,
        conditionFlags: ['good'],
      })
      .expect(201);
    const putAway = await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId: pallet.body.id, assignedToUserId: staff.id, location: 'Aisle 1' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/put-away-tasks/${putAway.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/put-away-tasks/${putAway.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);

    const notFound = await request(app.getHttpServer())
      .get('/search')
      .query({ q: putAway.body.id })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(notFound.body.tasks.some((t: { id: string }) => t.id === putAway.body.id)).toBe(false);
  });
});
