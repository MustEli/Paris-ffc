import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from './../src/app.module';
import { DELIVERY_PROOF_PHOTOS_MAX, DELIVERY_PROOF_PHOTOS_MIN } from '../src/seller-stock/seller-stock.types';
import { closeTestDb, resetDatabase } from './utils/db';

// Covers intake only (Feature 3). Put-away assignment (Feature 4) — the
// old instructions/put-away endpoints that used to live on this
// controller — moved to put-away.e2e-spec.ts along with the module.

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

/**
 * A Good Condition, non-overweight pallet is instant self-put-away now
 * (see SellerStockService.create()), so it never actually reaches
 * ready_for_putaway via the public API any more. selfPutAway() is
 * still real code though (what any pre-existing historical pallet in
 * that status would still go through), so this seeds one directly via
 * Prisma — the same approach used for Reception's equivalent gap.
 */
async function seedReadyForPutawayPallet(app: INestApplication<App>): Promise<string> {
  const prisma = app.get(PrismaService);
  const id = randomUUID();
  await prisma.sellerStockPallet.create({
    data: {
      id,
      boxNumber: 'B-SEED',
      sellerName: 'Acme Parts',
      weightKg: 80,
      overweightFlag: false,
      condition: 'good',
      conditionFlags: ['good'],
      damageEvidencePhotoUrls: [],
      labelPhotoUrls: [],
      status: 'ready_for_putaway',
      createdByUserId: 'seed-test-user',
    },
  });
  return id;
}

describe('Seller Stock (e2e)', () => {
  let app: INestApplication<App>;
  let staffToken: string;

  beforeEach(async () => {
    await resetDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    staffToken = await loginAs(app, 'staff@warehousehq.dev');

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

  it('uploads a photo and returns a usable URL', async () => {
    const url = await uploadFakePhoto(app, staffToken);
    expect(url).toMatch(/^\/uploads\/.+/);
  });

  it('rejects a damaged pallet without damage remarks/evidence', async () => {
    const labelPhotoUrl1 = await uploadFakePhoto(app, staffToken);
    const labelPhotoUrl2 = await uploadFakePhoto(app, staffToken);
    return request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-1',
        sellerName: 'Acme Parts',
        weightKg: 50,
        conditionFlags: ['damaged'],
      })
      .expect(400);
  });

  it('auto-flags an overweight pallet even when marked good condition', async () => {
    const labelPhotoUrl1 = await uploadFakePhoto(app, staffToken);
    const labelPhotoUrl2 = await uploadFakePhoto(app, staffToken);
    const created = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-2',
        sellerName: 'Acme Parts',
        weightKg: 750,
        conditionFlags: ['good'],
      })
      .expect(201);

    expect(created.body.overweightFlag).toBe(true);
    expect(created.body.status).toBe('pending_admin_review');
  });

  it('logs a good-condition pallet with multiple label photos, already put away, with no putAwayLocation collected', async () => {
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
        conditionFlags: ['good'],
      })
      .expect(201);
    expect(created.body.status).toBe('put_away');
    expect(created.body.putAwayLocation).toBeNull();
    expect(created.body.putAwayAt).not.toBeNull();
    expect(created.body.palletIndex).toBe('Acme Parts-B-3');
    expect(created.body.labelPhotoUrls).toEqual([labelPhotoUrl1, labelPhotoUrl2]);

    const listed = await request(app.getHttpServer())
      .get('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(listed.body.some((p: { id: string }) => p.id === created.body.id)).toBe(true);
  });

  it('disambiguates palletIndex with "(#seq)" when two pallets share the same seller + box number, on both the single-pallet and list endpoints', async () => {
    const labelPhotoUrl = await uploadFakePhoto(app, staffToken);
    const makePallet = () =>
      request(app.getHttpServer())
        .post('/seller-stock')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          labelPhotoUrls: [labelPhotoUrl, labelPhotoUrl],
          boxNumber: 'B-DUPE',
          sellerName: 'Dupe Seller',
          weightKg: 10,
          conditionFlags: ['good'],
        })
        .expect(201);

    const first = await makePallet();
    // Not yet ambiguous — it's the only "Dupe Seller-B-DUPE" pallet so far.
    expect(first.body.palletIndex).toBe('Dupe Seller-B-DUPE');

    const second = await makePallet();
    expect(second.body.palletIndex).toBe(`Dupe Seller-B-DUPE (#${second.body.palletIndex.match(/#(\d+)/)![1]})`);

    // Re-fetching the first one directly now also shows it as ambiguous
    // (collision detection isn't a one-time snapshot from creation time).
    const firstRefetched = await request(app.getHttpServer())
      .get(`/seller-stock/${first.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(firstRefetched.body.palletIndex).toMatch(/^Dupe Seller-B-DUPE \(#\d+\)$/);

    const listed = await request(app.getHttpServer())
      .get('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    const listedFirst = listed.body.find((p: { id: string }) => p.id === first.body.id);
    const listedSecond = listed.body.find((p: { id: string }) => p.id === second.body.id);
    expect(listedFirst.palletIndex).toMatch(/^Dupe Seller-B-DUPE \(#\d+\)$/);
    expect(listedSecond.palletIndex).toMatch(/^Dupe Seller-B-DUPE \(#\d+\)$/);
    expect(listedFirst.palletIndex).not.toBe(listedSecond.palletIndex);
  });

  it('rejects a pallet flagged good + damaged together without damage remarks/evidence', async () => {
    const labelPhotoUrl1 = await uploadFakePhoto(app, staffToken);
    const labelPhotoUrl2 = await uploadFakePhoto(app, staffToken);
    return request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-4',
        sellerName: 'Acme Parts',
        weightKg: 50,
        conditionFlags: ['good', 'damaged'],
      })
      .expect(400);
  });

  it('rejects an unknown condition flag', async () => {
    const labelPhotoUrl1 = await uploadFakePhoto(app, staffToken);
    const labelPhotoUrl2 = await uploadFakePhoto(app, staffToken);
    return request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-4b',
        sellerName: 'Acme Parts',
        weightKg: 50,
        conditionFlags: ['not_a_real_flag'],
      })
      .expect(400);
  });

  it('lets Staff self-confirm put-away for a seeded ready_for_putaway pallet, but not for a flagged one', async () => {
    // Seeded (see seedReadyForPutawayPallet's doc comment) — a new Good
    // Condition, non-overweight pallet never reaches this status any
    // more, it's instant put_away at creation (covered by "logs a
    // good-condition pallet with multiple label photos, already put
    // away" above). selfPutAway() is still real code for whatever
    // historical pallet might still be sitting in ready_for_putaway.
    const readyId = await seedReadyForPutawayPallet(app);

    const putAway = await request(app.getHttpServer())
      .post(`/seller-stock/${readyId}/self-putaway`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    expect(putAway.body.status).toBe('put_away');
    expect(putAway.body.putAwayAt).not.toBeNull();

    const damagedLabel1 = await uploadFakePhoto(app, staffToken);
    const damagedLabel2 = await uploadFakePhoto(app, staffToken);
    const damagedPhoto = await uploadFakePhoto(app, staffToken);
    const flagged = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [damagedLabel1, damagedLabel2],
        boxNumber: 'B-SELF-2',
        sellerName: 'Acme Parts',
        weightKg: 80,
        conditionFlags: ['damaged'],
        damageRemarks: 'Dented corner',
        damageEvidencePhotoUrls: [damagedPhoto],
      })
      .expect(201);
    expect(flagged.body.status).toBe('pending_admin_review');

    await request(app.getHttpServer())
      .post(`/seller-stock/${flagged.body.id}/self-putaway`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);
  });

  it('runs the damaged path with evidence photos', async () => {
    const labelPhotoUrl1 = await uploadFakePhoto(app, staffToken);
    const labelPhotoUrl2 = await uploadFakePhoto(app, staffToken);
    const damagePhotoUrl = await uploadFakePhoto(app, staffToken);

    const created = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-5',
        sellerName: 'Acme Parts',
        weightKg: 200,
        conditionFlags: ['damaged'],
        damageRemarks: 'Crushed corner, contents visible',
        damageEvidencePhotoUrls: [damagePhotoUrl],
      })
      .expect(201);

    expect(created.body.status).toBe('pending_admin_review');
    expect(created.body.damageEvidencePhotoUrls).toEqual([damagePhotoUrl]);
  });

  it(`rejects more than ${DELIVERY_PROOF_PHOTOS_MAX} Delivery Proof photos`, async () => {
    const tooMany = await Promise.all(
      Array.from({ length: DELIVERY_PROOF_PHOTOS_MAX + 1 }, () => uploadFakePhoto(app, staffToken)),
    );

    return request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: tooMany,
        boxNumber: 'B-6',
        sellerName: 'Acme Parts',
        weightKg: 50,
        conditionFlags: ['good'],
      })
      .expect(400);
  });

  it(`rejects fewer than ${DELIVERY_PROOF_PHOTOS_MIN} Delivery Proof photos`, async () => {
    const onlyOne = await uploadFakePhoto(app, staffToken);

    return request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [onlyOne],
        boxNumber: 'B-7',
        sellerName: 'Acme Parts',
        weightKg: 50,
        conditionFlags: ['good'],
      })
      .expect(400);
  });

  it('blocks Staff from this controller entirely without an active shift, but never blocks Admin', async () => {
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', `Bearer ${staffToken}`).expect(201);

    await request(app.getHttpServer())
      .get('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    const adminToken = await loginAs(app, 'admin@warehousehq.dev');
    // Admin has no shift at all, ever — never gated by this.
    await request(app.getHttpServer())
      .get('/seller-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('blocks Staff from this controller while on any break, and restores access once it ends', async () => {
    await request(app.getHttpServer())
      .post('/shifts/break/start')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ type: 'short' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/shifts/break/end')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });

  it('deletes a single pallet, and rejects a non-admin trying to', async () => {
    const labelPhotoUrl1 = await uploadFakePhoto(app, staffToken);
    const labelPhotoUrl2 = await uploadFakePhoto(app, staffToken);
    const created = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-DEL-1',
        sellerName: 'Acme Parts',
        weightKg: 50,
        conditionFlags: ['good'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/seller-stock/${created.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    const adminToken = await loginAs(app, 'admin@warehousehq.dev');
    await request(app.getHttpServer())
      .delete(`/seller-stock/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/seller-stock/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('bulk-deletes several pallets at once', async () => {
    const labelPhotoUrl1 = await uploadFakePhoto(app, staffToken);
    const labelPhotoUrl2 = await uploadFakePhoto(app, staffToken);
    const first = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-DEL-2',
        sellerName: 'Acme Parts',
        weightKg: 50,
        conditionFlags: ['good'],
      })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/seller-stock')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        labelPhotoUrls: [labelPhotoUrl1, labelPhotoUrl2],
        boxNumber: 'B-DEL-3',
        sellerName: 'Acme Parts',
        weightKg: 50,
        conditionFlags: ['good'],
      })
      .expect(201);

    const adminToken = await loginAs(app, 'admin@warehousehq.dev');
    const result = await request(app.getHttpServer())
      .delete('/seller-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: [first.body.id, second.body.id] })
      .expect(200);
    expect(result.body.deletedCount).toBe(2);

    const listed = await request(app.getHttpServer())
      .get('/seller-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.some((p: { id: string }) => p.id === first.body.id || p.id === second.body.id)).toBe(false);
  });
});
