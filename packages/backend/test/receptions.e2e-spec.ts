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
});
