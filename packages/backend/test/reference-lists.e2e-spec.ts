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

describe('Reference Lists (e2e)', () => {
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

  it('starts empty for every known category', async () => {
    const response = await request(app.getHttpServer())
      .get('/reference-lists')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(response.body).toEqual({ transporter_company: [], packaging_type: [] });
  });

  it('lets Admin add a value, and Staff (read-only) can see it', async () => {
    const created = await request(app.getHttpServer())
      .post('/reference-lists/transporter_company')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'DHL' })
      .expect(201);
    expect(created.body).toMatchObject({ category: 'transporter_company', value: 'DHL' });

    const staffView = await request(app.getHttpServer())
      .get('/reference-lists/transporter_company')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(staffView.body).toHaveLength(1);
    expect(staffView.body[0].value).toBe('DHL');
  });

  it('rejects Staff trying to add a value', () => {
    return request(app.getHttpServer())
      .post('/reference-lists/transporter_company')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ value: 'DHL' })
      .expect(403);
  });

  it('rejects a duplicate value in the same category, case-insensitively', async () => {
    await request(app.getHttpServer())
      .post('/reference-lists/transporter_company')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'DHL' })
      .expect(201);

    return request(app.getHttpServer())
      .post('/reference-lists/transporter_company')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'dhl' })
      .expect(409);
  });

  it('rejects an unknown category with 400, not a raw database error', () => {
    return request(app.getHttpServer())
      .get('/reference-lists/not-a-real-category')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('lets Admin remove a value', async () => {
    const created = await request(app.getHttpServer())
      .post('/reference-lists/packaging_type')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'Boxes' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/reference-lists/packaging_type/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get('/reference-lists/packaging_type')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterDelete.body).toEqual([]);
  });

  it('keeps categories independent — a value in one does not appear in another', async () => {
    await request(app.getHttpServer())
      .post('/reference-lists/transporter_company')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'Same Name' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/reference-lists/packaging_type')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'Same Name' })
      .expect(201);

    const all = await request(app.getHttpServer())
      .get('/reference-lists')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(all.body.transporter_company).toHaveLength(1);
    expect(all.body.packaging_type).toHaveLength(1);
  });
});
