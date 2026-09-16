import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { closeTestDb, resetDatabase } from './utils/db';

async function loginAs(app: INestApplication<App>, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(201);
  return response.body.accessToken as string;
}

describe('Receptions (e2e)', () => {
  let app: INestApplication<App>;
  let staffToken: string;
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    staffToken = await loginAs(app, 'staff@warehousehq.dev');
    adminToken = await loginAs(app, 'admin@warehousehq.dev');

    // ActiveShiftGuard: Staff can't use this controller at all without an
    // active shift. Every existing test here acts as Staff, so start one
    // globally rather than repeating it in each test.
    await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('rejects an incomplete category payload', () => {
    return request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'return_parcels', parcelCount: 3 }) // missing transporterCompany
      .expect(400);
  });

  it('rejects a non-admin trying to give instructions', async () => {
    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'return_parcels', parcelCount: 3, transporterCompany: 'Acme Logistics' })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/instructions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ instructions: 'Put in aisle 4' })
      .expect(403);
  });

  it('rejects completing before instructions exist', async () => {
    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'sellers_stock', palletCount: 5 })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);
  });

  it('runs the full arrival → instructions → put-away flow and computes duration', async () => {
    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'packaging_stock', parcelCount: 10, packagingType: 'Cardboard boxes' })
      .expect(201);
    expect(created.body.status).toBe('arrived');

    const listed = await request(app.getHttpServer())
      .get('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(listed.body.some((r: { id: string }) => r.id === created.body.id)).toBe(true);

    const instructed = await request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/instructions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ instructions: 'Stack in aisle 4, bay 2' })
      .expect(201);
    expect(instructed.body.status).toBe('ready_for_putaway');
    expect(instructed.body.instructions).toBe('Stack in aisle 4, bay 2');

    const completed = await request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.processingDurationMs).toBeGreaterThanOrEqual(0);
    expect(completed.body.flaggedForReview).toBe(false);
  });

  it('blocks Staff from this controller entirely without an active shift, but never blocks Admin', async () => {
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', `Bearer ${staffToken}`).expect(201);

    await request(app.getHttpServer())
      .get('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'packaging_stock', parcelCount: 1, packagingType: 'Boxes' })
      .expect(403);

    // Admin has no shift at all, ever — never gated by this.
    await request(app.getHttpServer()).get('/receptions').set('Authorization', `Bearer ${adminToken}`).expect(200);
  });

  it('applies bulk instructions independently per row, without aborting on a bad one', async () => {
    const first = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'sellers_stock', palletCount: 2 })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'sellers_stock', palletCount: 5 })
      .expect(201);

    const result = await request(app.getHttpServer())
      .post('/receptions/bulk-instructions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: first.body.id, instructions: 'Aisle 1' },
          { id: 'not-a-real-id', instructions: 'Aisle 2' },
          { id: second.body.id, instructions: 'Aisle 3' },
        ],
      })
      .expect(201);

    expect(result.body).toEqual([
      { id: first.body.id, success: true, error: null },
      { id: 'not-a-real-id', success: false, error: expect.any(String) },
      { id: second.body.id, success: true, error: null },
    ]);

    const reloadedFirst = await request(app.getHttpServer())
      .get(`/receptions/${first.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reloadedFirst.body.instructions).toBe('Aisle 1');
    expect(reloadedFirst.body.status).toBe('ready_for_putaway');
  });

  it('rejects Staff calling bulk-instructions', () => {
    return request(app.getHttpServer())
      .post('/receptions/bulk-instructions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ id: 'irrelevant', instructions: 'x' }] })
      .expect(403);
  });
});
