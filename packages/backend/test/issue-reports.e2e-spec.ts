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

describe('Issue Reports (e2e)', () => {
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

  it('creates a Non-traceable Return Parcel report and flags it for Admin', async () => {
    const created = await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'non_traceable_return_parcel',
        photoUrls: ['https://example.com/parcel.jpg'],
        trackingId: 'ABC123',
        comment: 'Found at dock 3',
      })
      .expect(201);
    expect(created.body.alertsAdmin).toBe(true);
    expect(created.body.trackingId).toBe('ABC123');
  });

  it('rejects a Non-traceable Return Parcel report missing its required photo', () => {
    return request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'non_traceable_return_parcel', trackingId: 'ABC123', comment: 'No photo' })
      .expect(400);
  });

  it('rejects a trackingId that is not capital letters and numbers', () => {
    return request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'non_traceable_return_parcel',
        photoUrls: ['https://example.com/parcel.jpg'],
        trackingId: 'abc 123!',
        comment: 'bad id',
      })
      .expect(400);
  });

  it('creates a No Return Request Generated report with no photo required', async () => {
    const created = await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'no_return_request_generated',
        trackingId: 'XYZ999',
        orderNumber: '48213',
        comment: 'Customer changed mind',
      })
      .expect(201);
    expect(created.body.orderNumber).toBe('48213');
    expect(created.body.alertsAdmin).toBe(true);
  });

  it('rejects a non-numeric orderNumber', () => {
    return request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'no_return_request_generated',
        trackingId: 'XYZ999',
        orderNumber: '482-13',
        comment: 'bad order number',
      })
      .expect(400);
  });

  it('requires both errorNo and comment as separate fields for Shipment Label Not Generatable', async () => {
    await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'shipment_label_not_generatable',
        photoUrls: ['https://example.com/error.jpg'],
        orderNumber: '1001',
        errorNo: 'E-42',
      })
      .expect(400); // missing comment

    const created = await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'shipment_label_not_generatable',
        photoUrls: ['https://example.com/error.jpg'],
        orderNumber: '1001',
        errorNo: 'E-42',
        comment: 'Carrier system down',
      })
      .expect(201);
    expect(created.body.errorNo).toBe('E-42');
    expect(created.body.comment).toBe('Carrier system down');
  });

  it('records Item Found Out of Location without flagging Admin', async () => {
    const created = await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'item_found_out_of_location',
        photoUrls: ['https://example.com/item.jpg'],
        idNumber: '77',
        comment: 'Handed to Jamal',
      })
      .expect(201);
    expect(created.body.alertsAdmin).toBe(false);
  });

  it('records Empty Crate and Heavy Crate without flagging Admin, and without needing a comment', async () => {
    const emptyCrate = await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'empty_crate', photoUrls: ['https://example.com/crate.jpg'], locationId: 'A12B' })
      .expect(201);
    expect(emptyCrate.body.alertsAdmin).toBe(false);

    const heavyCrate = await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'heavy_crate', photoUrls: ['https://example.com/crate2.jpg'], locationId: 'C03' })
      .expect(201);
    expect(heavyCrate.body.alertsAdmin).toBe(false);
  });

  it('creates a Part Broken in the Location report with photos and flags Admin', async () => {
    const created = await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({
        category: 'part_broken_in_location',
        locationId: 'D9',
        photoUrls: ['https://example.com/broken1.jpg', 'https://example.com/broken2.jpg'],
        comment: 'Part ID 445, likely dropped',
      })
      .expect(201);
    expect(created.body.alertsAdmin).toBe(true);
    expect(created.body.photoUrls).toHaveLength(2);
  });

  it('creates an Other report with just a comment, flagging Admin, and allows an optional photo', async () => {
    const created = await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'other', comment: 'Forklift blocking aisle 2' })
      .expect(201);
    expect(created.body.alertsAdmin).toBe(true);
    expect(created.body.photoUrls).toEqual([]);
  });

  it('rejects an Other report with no comment', () => {
    return request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'other' })
      .expect(400);
  });

  it('lets Admin list all reports with the reporter name, but rejects a non-admin', async () => {
    await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'other', comment: 'Something odd' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/issue-reports')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].userName).toBe('Sam Staff');

    await request(app.getHttpServer())
      .get('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);
  });

  it('blocks Staff from reporting without an active shift, but never blocks Admin from listing', async () => {
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', `Bearer ${staff.token}`).expect(201);

    await request(app.getHttpServer())
      .post('/issue-reports')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ category: 'other', comment: 'Should be blocked' })
      .expect(403);

    await request(app.getHttpServer())
      .get('/issue-reports')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
  });
});
