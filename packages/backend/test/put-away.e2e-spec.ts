import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';

async function loginAs(app: INestApplication<App>, email: string): Promise<{ token: string; id: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(201);
  return { token: response.body.accessToken as string, id: response.body.user.id as string };
}

async function createReadyPallet(app: INestApplication<App>, staffToken: string): Promise<string> {
  const photo = await request(app.getHttpServer())
    .post('/uploads')
    .set('Authorization', `Bearer ${staffToken}`)
    .attach('file', Buffer.from('fake-image-bytes'), 'label.jpg')
    .expect(201);

  const pallet = await request(app.getHttpServer())
    .post('/seller-stock')
    .set('Authorization', `Bearer ${staffToken}`)
    .send({
      labelPhotoUrls: [photo.body.url],
      boxNumber: 'B-100',
      sellerName: 'Acme Parts',
      weightKg: 100,
      condition: 'good',
    })
    .expect(201);
  return pallet.body.id as string;
}

describe('Put-Away (e2e)', () => {
  let app: INestApplication<App>;
  let staff: { token: string; id: string };
  let admin: { token: string; id: string };

  beforeEach(async () => {
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

  it('lists staff users for the assignment picker', async () => {
    const response = await request(app.getHttpServer())
      .get('/users?role=staff')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(response.body.every((u: { role: string }) => u.role === 'staff')).toBe(true);
    expect(response.body.some((u: { id: string }) => u.id === staff.id)).toBe(true);
    // No password hash should ever leak.
    expect(response.body[0].passwordHash).toBeUndefined();
  });

  it('rejects a non-admin trying to assign a task', async () => {
    const palletId = await createReadyPallet(app, staff.token);
    return request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 1' })
      .expect(403);
  });

  it('rejects assigning to a non-staff user', async () => {
    const palletId = await createReadyPallet(app, staff.token);
    return request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: admin.id, location: 'Aisle 1' })
      .expect(400);
  });

  it('rejects a staff member acting on someone else\'s task', async () => {
    const palletId = await createReadyPallet(app, staff.token);
    const assigned = await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 1' })
      .expect(201);

    // Management token stands in for "a different, uninvolved user".
    const management = await loginAs(app, 'management@warehousehq.dev');
    return request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/start`)
      .set('Authorization', `Bearer ${management.token}`)
      .expect(403);
  });

  it('runs the full happy path: assign → start → complete, computing duration and updating the pallet', async () => {
    const palletId = await createReadyPallet(app, staff.token);

    const assigned = await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 7, bay 3' })
      .expect(201);
    expect(assigned.body.status).toBe('assigned');

    // Pallet should now be 'instructed' as a side effect.
    const palletAfterAssign = await request(app.getHttpServer())
      .get(`/seller-stock/${palletId}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(palletAfterAssign.body.status).toBe('instructed');
    expect(palletAfterAssign.body.putAwayLocation).toBe('Aisle 7, bay 3');

    const started = await request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(started.body.status).toBe('in_progress');

    const completed = await request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.durationMs).toBeGreaterThanOrEqual(0);

    const palletAfterComplete = await request(app.getHttpServer())
      .get(`/seller-stock/${palletId}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(palletAfterComplete.body.status).toBe('put_away');
  });

  it('rejects completing a task that was never started', async () => {
    const palletId = await createReadyPallet(app, staff.token);
    const assigned = await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 1' })
      .expect(201);

    return request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);
  });

  it('rejects a second assignment while one is already active for the same pallet', async () => {
    const palletId = await createReadyPallet(app, staff.token);
    await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 1' })
      .expect(201);

    return request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 2' })
      .expect(409);
  });

  it('runs the exception path: report issue → admin reassigns → staff completes', async () => {
    const palletId = await createReadyPallet(app, staff.token);
    const assigned = await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 1' })
      .expect(201);

    const issued = await request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/report-issue`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ description: 'Too many heavy boxes blocking the aisle' })
      .expect(201);
    expect(issued.body.status).toBe('issue_reported');

    // Can't start/complete while issue_reported.
    await request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(409);

    const reassigned = await request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/reassign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ assignedToUserId: staff.id, location: 'Aisle 9, bay 1' })
      .expect(201);
    expect(reassigned.body.status).toBe('assigned');
    expect(reassigned.body.issueDescription).toBeNull();
    expect(reassigned.body.location).toBe('Aisle 9, bay 1');

    await request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/start`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    const completed = await request(app.getHttpServer())
      .post(`/put-away-tasks/${assigned.body.id}/complete`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(201);
    expect(completed.body.status).toBe('completed');
  });

  it("staff only sees their own tasks; admin sees all", async () => {
    const palletId = await createReadyPallet(app, staff.token);
    await request(app.getHttpServer())
      .post('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ palletId, assignedToUserId: staff.id, location: 'Aisle 1' })
      .expect(201);

    const staffView = await request(app.getHttpServer())
      .get('/put-away-tasks')
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(staffView.body.every((t: { assignedToUserId: string }) => t.assignedToUserId === staff.id)).toBe(true);

    const adminView = await request(app.getHttpServer())
      .get('/put-away-tasks')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(adminView.body.length).toBeGreaterThanOrEqual(staffView.body.length);
  });
});
