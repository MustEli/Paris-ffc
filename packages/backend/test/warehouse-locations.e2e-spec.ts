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

describe('Warehouse Locations (e2e)', () => {
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

  it('starts empty, and Staff (read-only) can see it', async () => {
    const response = await request(app.getHttpServer())
      .get('/warehouse-locations')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('lets Admin add a location with a description, and Staff can see it', async () => {
    const created = await request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Zone A - Rack 04', description: 'Near the loading dock' })
      .expect(201);
    expect(created.body).toMatchObject({ location: 'Zone A - Rack 04', description: 'Near the loading dock' });

    const staffView = await request(app.getHttpServer())
      .get('/warehouse-locations')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(staffView.body).toHaveLength(1);
    expect(staffView.body[0].location).toBe('Zone A - Rack 04');
  });

  it('allows a location with no description', async () => {
    const created = await request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Zone B' })
      .expect(201);
    expect(created.body).toMatchObject({ location: 'Zone B', description: null });
  });

  it('rejects Staff trying to add a location', () => {
    return request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ location: 'Zone A' })
      .expect(403);
  });

  it('rejects a duplicate location, case-insensitively', async () => {
    await request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Zone A' })
      .expect(201);

    return request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'zone a' })
      .expect(409);
  });

  it('lets Admin edit a location’s description', async () => {
    const created = await request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Zone A', description: 'Old description' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/warehouse-locations/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'New description' })
      .expect(200);
    expect(updated.body).toMatchObject({ location: 'Zone A', description: 'New description' });
  });

  it('rejects Staff trying to edit a location', async () => {
    const created = await request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Zone A' })
      .expect(201);

    return request(app.getHttpServer())
      .patch(`/warehouse-locations/${created.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ description: 'Hacked' })
      .expect(403);
  });

  it('lets Admin remove a location', async () => {
    const created = await request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Zone A' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/warehouse-locations/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterDelete.body).toEqual([]);
  });

  it('bulk-upserts: creates new rows and updates the description of existing ones by name', async () => {
    await request(app.getHttpServer())
      .post('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Zone A', description: 'Old' })
      .expect(201);

    const result = await request(app.getHttpServer())
      .post('/warehouse-locations/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rows: [
          { location: 'Zone A', description: 'Updated via bulk' },
          { location: 'Zone C', description: 'Brand new' },
        ],
      })
      .expect(201);
    expect(result.body).toEqual([
      { location: 'Zone A', success: true },
      { location: 'Zone C', success: true },
    ]);

    const all = await request(app.getHttpServer())
      .get('/warehouse-locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(all.body).toHaveLength(2);
    expect(all.body.find((l: { location: string }) => l.location === 'Zone A')).toMatchObject({
      description: 'Updated via bulk',
    });
  });

  it('rejects Staff trying to bulk-upload', () => {
    return request(app.getHttpServer())
      .post('/warehouse-locations/bulk')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ rows: [{ location: 'Zone A' }] })
      .expect(403);
  });
});
