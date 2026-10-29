import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from './../src/app.module';
import { closeTestDb, resetDatabase } from './utils/db';

async function loginAs(app: INestApplication<App>, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(201);
  return response.body.accessToken as string;
}

/**
 * return_parcels, packaging_stock, and equipment_other are all instant-
 * complete now, and sellers_stock can't be created via POST /receptions
 * at all (see the "rejects creating a new reception in the
 * sellers_stock category" test below) — so there's no longer any
 * *creatable* path to a reception that actually sits in `arrived`. The
 * instructions/complete flow is still real code though (it's what any
 * pre-existing historical sellers_stock reception would still go
 * through), so these two tests seed one directly via Prisma rather
 * than through the public API, the same way such a historical row
 * would actually exist.
 */
async function seedArrivedSellersStockReception(app: INestApplication<App>, palletCount: number): Promise<string> {
  const prisma = app.get(PrismaService);
  const id = randomUUID();
  await prisma.reception.create({
    data: {
      id,
      createdByUserId: 'seed-test-user',
      status: 'arrived',
      category: 'sellers_stock',
      palletCount,
      arrivedAt: new Date(),
    },
  });
  return id;
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

  it('requires at least one equipment photo and a putAwayLocation for equipment_other, and accepts an optional invoice photo', async () => {
    await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'equipment_other', parcelCount: 1, itemDescription: 'Pallet jack' }) // no photoUrls, no putAwayLocation
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        category: 'equipment_other',
        parcelCount: 1,
        itemDescription: 'Pallet jack',
        photoUrls: ['https://example.com/jack.jpg'],
        invoicePhotoUrls: ['https://example.com/invoice.jpg'],
        putAwayLocation: 'Zone D, Rack 3',
      })
      .expect(201);
    expect(created.body.status).toBe('completed');
    expect(created.body.details.photoUrls).toEqual(['https://example.com/jack.jpg']);
    expect(created.body.details.invoicePhotoUrls).toEqual(['https://example.com/invoice.jpg']);
    expect(created.body.details.putAwayLocation).toBe('Zone D, Rack 3');
  });

  it('requires putAwayLocation for packaging_stock, no longer collects sellerName, and defaults invoicePhotoUrls to empty when omitted', async () => {
    await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'packaging_stock', parcelCount: 5, packagingType: 'Boxes' }) // no putAwayLocation
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'packaging_stock', parcelCount: 5, packagingType: 'Boxes', putAwayLocation: 'Zone B, Rack 1' })
      .expect(201);
    expect(created.body.details.sellerName).toBeNull();
    expect(created.body.details.putAwayLocation).toBe('Zone B, Rack 1');
    expect(created.body.details.invoicePhotoUrls).toEqual([]);
    expect(created.body.status).toBe('completed');
  });

  it('rejects a non-admin trying to give instructions', () => {
    // RolesGuard denies before the controller ever looks the id up, so
    // no reception needs to actually exist for this to prove the point.
    return request(app.getHttpServer())
      .post('/receptions/irrelevant-id/instructions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ instructions: 'Put in aisle 4' })
      .expect(403);
  });

  it('rejects return_parcels missing putAwayLocation', () => {
    return request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'return_parcels', parcelCount: 3, transporterCompany: 'Acme Logistics' }) // missing putAwayLocation
      .expect(400);
  });

  it('creates return_parcels already completed, with no admin instructions step', async () => {
    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        category: 'return_parcels',
        parcelCount: 3,
        transporterCompany: 'Acme Logistics',
        putAwayLocation: 'Zone A, Rack 2',
      })
      .expect(201);

    expect(created.body.status).toBe('completed');
    expect(created.body.instructions).toBeNull();
    expect(created.body.putAwayAt).not.toBeNull();
    expect(created.body.processingDurationMs).toBe(0);
    expect(created.body.flaggedForReview).toBe(false);
    expect(created.body.details.putAwayLocation).toBe('Zone A, Rack 2');

    // Never passed through arrived, so there's nothing for Admin to instruct on.
    await request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/instructions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ instructions: 'Stack in aisle 4' })
      .expect(409);
  });

  it('creates packaging_stock already completed, with no admin instructions step', async () => {
    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'packaging_stock', parcelCount: 10, packagingType: 'Cardboard boxes', putAwayLocation: 'Zone C, Rack 4' })
      .expect(201);

    expect(created.body.status).toBe('completed');
    expect(created.body.instructions).toBeNull();
    expect(created.body.putAwayAt).not.toBeNull();
    expect(created.body.processingDurationMs).toBe(0);
    expect(created.body.flaggedForReview).toBe(false);
    expect(created.body.details.putAwayLocation).toBe('Zone C, Rack 4');

    await request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/instructions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ instructions: 'Stack in aisle 4' })
      .expect(409);
  });

  it('creates equipment_other already completed, with no admin instructions step', async () => {
    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        category: 'equipment_other',
        parcelCount: 2,
        itemDescription: 'Pallet jack',
        photoUrls: ['https://example.com/jack.jpg'],
        putAwayLocation: 'Zone D, Rack 3',
      })
      .expect(201);

    expect(created.body.status).toBe('completed');
    expect(created.body.instructions).toBeNull();
    expect(created.body.putAwayAt).not.toBeNull();
    expect(created.body.processingDurationMs).toBe(0);
    expect(created.body.flaggedForReview).toBe(false);
    expect(created.body.details.putAwayLocation).toBe('Zone D, Rack 3');

    await request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/instructions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ instructions: 'Stack in aisle 4' })
      .expect(409);
  });

  it('rejects creating a new reception in the sellers_stock category — redundant now that Seller Stock is its own feature', () => {
    return request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category: 'sellers_stock', palletCount: 1 })
      .expect(400);
  });

  it('rejects completing a reception not in ready_for_putaway status', async () => {
    // equipment_other is instant-complete now, so the reachable way to
    // hit this guard is "already completed" rather than "never started"
    // — same 409, different trigger. See the seeded-sellers_stock test
    // below for the "never started" case (genuinely still reachable,
    // just not via a creatable category).
    const created = await request(app.getHttpServer())
      .post('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        category: 'equipment_other',
        parcelCount: 1,
        itemDescription: 'Pallet jack',
        photoUrls: ['https://example.com/jack.jpg'],
        putAwayLocation: 'Zone D, Rack 3',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/receptions/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);
  });

  it('runs the full arrival → instructions → put-away flow and computes duration (seeded sellers_stock — see seedArrivedSellersStockReception)', async () => {
    const id = await seedArrivedSellersStockReception(app, 10);

    const listed = await request(app.getHttpServer())
      .get('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(listed.body.some((r: { id: string }) => r.id === id)).toBe(true);

    const instructed = await request(app.getHttpServer())
      .post(`/receptions/${id}/instructions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ instructions: 'Stack in aisle 4, bay 2' })
      .expect(201);
    expect(instructed.body.status).toBe('ready_for_putaway');
    expect(instructed.body.instructions).toBe('Stack in aisle 4, bay 2');

    const completed = await request(app.getHttpServer())
      .post(`/receptions/${id}/complete`)
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
      .send({ category: 'packaging_stock', parcelCount: 1, packagingType: 'Boxes', putAwayLocation: 'Zone B, Rack 1' })
      .expect(403);

    // Admin has no shift at all, ever — never gated by this.
    await request(app.getHttpServer()).get('/receptions').set('Authorization', `Bearer ${adminToken}`).expect(200);
  });

  it('blocks Staff from this controller while on any break, and restores access once it ends', async () => {
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ type: 'lunch' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/shifts/break/end')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/receptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });

  it('applies bulk instructions independently per row, without aborting on a bad one', async () => {
    // Seeded (see seedArrivedSellersStockReception's doc comment) — no
    // creatable category reaches `arrived` anymore for this to exercise.
    const firstId = await seedArrivedSellersStockReception(app, 2);
    const secondId = await seedArrivedSellersStockReception(app, 5);

    const result = await request(app.getHttpServer())
      .post('/receptions/bulk-instructions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: firstId, instructions: 'Aisle 1' },
          { id: 'not-a-real-id', instructions: 'Aisle 2' },
          { id: secondId, instructions: 'Aisle 3' },
        ],
      })
      .expect(201);

    expect(result.body).toEqual([
      { id: firstId, success: true, error: null },
      { id: 'not-a-real-id', success: false, error: expect.any(String) },
      { id: secondId, success: true, error: null },
    ]);

    const reloadedFirst = await request(app.getHttpServer())
      .get(`/receptions/${firstId}`)
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
