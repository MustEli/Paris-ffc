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

describe('User Management (e2e)', () => {
  let app: INestApplication<App>;
  let admin: { token: string; id: string };
  let staff: { token: string; id: string };
  let management: { token: string; id: string };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    admin = await loginAs(app, 'admin@warehousehq.dev');
    staff = await loginAs(app, 'staff@warehousehq.dev');
    management = await loginAs(app, 'management@warehousehq.dev');
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects a non-admin (management) creating a user', () => {
    return request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${management.token}`)
      .send({ name: 'New Person', email: 'new-person@warehousehq.dev', password: 'password123', role: 'staff' })
      .expect(403);
  });

  it('creates a user, hides the password hash, and lets them log in', async () => {
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Jamie New', email: 'jamie@warehousehq.dev', password: 'letmein123', role: 'staff' })
      .expect(201);

    expect(created.body.passwordHash).toBeUndefined();
    expect(created.body.role).toBe('staff');

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'jamie@warehousehq.dev', password: 'letmein123' })
      .expect(201);
    expect(login.body.user.id).toBe(created.body.id);
  });

  it('rejects creating a user with an email that already exists', () => {
    return request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Dupe', email: 'staff@warehousehq.dev', password: 'password123', role: 'staff' })
      .expect(409);
  });

  it('rejects removing your own account', () => {
    return request(app.getHttpServer())
      .delete(`/users/${admin.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
  });

  it('rejects a non-admin removing a user', () => {
    return request(app.getHttpServer())
      .delete(`/users/${staff.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(403);
  });

  it('removes a user, and they can no longer log in', async () => {
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Temp Person', email: 'temp@warehousehq.dev', password: 'password123', role: 'staff' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'temp@warehousehq.dev', password: 'password123' })
      .expect(401);
  });

  it('lets an admin remove a different admin, as long as one remains', async () => {
    const secondAdmin = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Second Admin', email: 'admin2@warehousehq.dev', password: 'password123', role: 'admin' })
      .expect(201);

    // Log in as the second admin, then remove the original — two admins exist at call time, so it's allowed.
    const secondAdminLogin = await loginAs(app, 'admin2@warehousehq.dev');
    await request(app.getHttpServer())
      .delete(`/users/${admin.id}`)
      .set('Authorization', `Bearer ${secondAdminLogin.token}`)
      .expect(200);

    expect(secondAdmin.body.role).toBe('admin');
  });

  it('changes a user role, reflected in a subsequent list', async () => {
    const changed = await request(app.getHttpServer())
      .post(`/users/${staff.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'management' })
      .expect(201);
    expect(changed.body.role).toBe('management');

    const list = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(list.body.find((u: { id: string }) => u.id === staff.id).role).toBe('management');
  });

  it('rejects the sole admin demoting themselves away from admin', () => {
    return request(app.getHttpServer())
      .post(`/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'staff' })
      .expect(400);
  });

  it('rejects a non-admin changing a role', () => {
    return request(app.getHttpServer())
      .post(`/users/${staff.id}/role`)
      .set('Authorization', `Bearer ${management.token}`)
      .send({ role: 'admin' })
      .expect(403);
  });
});
