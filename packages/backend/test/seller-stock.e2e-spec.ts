import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { MAX_PHOTOS_PER_FIELD } from '../src/seller-stock/seller-stock.types';

async function loginAs(app: INestApplication<App>, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(201);
  return response.body.accessToken as string;
}

async function uploadFakePhoto(app: INestApplication<App>, token: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/uploads')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from('fake-image-bytes'), 'label.jpg')
    .expect(201);
  return response.body.url as string;
}

describe('Seller Stock (e2e)', () => {
  let app: INestApplication<App>;
  let staffToken: string;
  let adminToken: string;

  beforeEach(async () => {
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

  it('uploads a photo and returns a usable URL', async () => {
    const url = await uploadFakePhoto(app, staffToken);
    expect(url).toMatch(/^\/uploads\/.+/);
  });

  it('rejects a damaged pallet without damage remarks/evidence', async () => {
    const labelPhotoUrl = await uploadFakePhoto(app, staffToken);
    return request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl],
        boxNumber: 'B-1',
        sellerName: 'Acme Parts',
        weightKg: 50,
        condition: 'damaged',
      })
      .expect(400);
  });

  it('auto-flags an overweight pallet even when marked good condition', async () => {
    const labelPhotoUrl = await uploadFakePhoto(app, staffToken);
    const created = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl],
        boxNumber: 'B-2',
        sellerName: 'Acme Parts',
        weightKg: 750,
        condition: 'good',
      })
      .expect(201);

    expect(created.body.overweightFlag).toBe(true);
    expect(created.body.status).toBe('pending_admin_review');
  });

  it('runs the good-condition happy path with multiple label photos: log → instructions → put-away', async () => {
    const labelPhotoUrl1 = await uploadFakePhoto(app, staffToken);
    const labelPhotoUrl2 = await uploadFakePhoto(app, staffToken);
    const created = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-3',
        sellerName: 'Acme Parts',
        weightKg: 120,
        condition: 'good',
      })
      .expect(201);
    expect(created.body.status).toBe('ready_for_putaway');
    expect(created.body.palletIndex).toMatch(/^PLT-\d{6}$/);
    expect(created.body.labelPhotoUrls).toEqual([labelPhotoUrl1, labelPhotoUrl2]);

    // Non-admin can't give instructions.
    await request(app.getHttpServer())
      .post(`/seller-stock/${created.body.id}/instructions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ location: 'Aisle 7' })
      .expect(403);

    const instructed = await request(app.getHttpServer())
      .post(`/seller-stock/${created.body.id}/instructions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Aisle 7, bay 3' })
      .expect(201);
    expect(instructed.body.status).toBe('instructed');

    const putAway = await request(app.getHttpServer())
      .post(`/seller-stock/${created.body.id}/put-away`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    expect(putAway.body.status).toBe('put_away');
  });

  it('rejects putting away before instructions exist', async () => {
    const labelPhotoUrl = await uploadFakePhoto(app, staffToken);
    const created = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl],
        boxNumber: 'B-4',
        sellerName: 'Acme Parts',
        weightKg: 90,
        condition: 'good',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/seller-stock/${created.body.id}/put-away`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);
  });

  it('runs the damaged path with evidence photos', async () => {
    const labelPhotoUrl = await uploadFakePhoto(app, staffToken);
    const damagePhotoUrl = await uploadFakePhoto(app, staffToken);

    const created = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl],
        boxNumber: 'B-5',
        sellerName: 'Acme Parts',
        weightKg: 200,
        condition: 'damaged',
        damageRemarks: 'Crushed corner, contents visible',
        damageEvidencePhotoUrls: [damagePhotoUrl],
      })
      .expect(201);

    expect(created.body.status).toBe('pending_admin_review');
    expect(created.body.damageEvidencePhotoUrls).toEqual([damagePhotoUrl]);
  });

  it(`rejects more than ${MAX_PHOTOS_PER_FIELD} label photos`, async () => {
    const tooMany = await Promise.all(
      Array.from({ length: MAX_PHOTOS_PER_FIELD + 1 }, () => uploadFakePhoto(app, staffToken)),
    );

    return request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: tooMany,
        boxNumber: 'B-6',
        sellerName: 'Acme Parts',
        weightKg: 50,
        condition: 'good',
      })
      .expect(400);
  });
});
