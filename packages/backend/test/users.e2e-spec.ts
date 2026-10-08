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

describe('Users — self-serve photo (e2e)', () => {
  let app: INestApplication<App>;
  let staff: { token: string; id: string };

  beforeEach(async () => {
    await resetDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    staff = await loginAs(app, 'staff@warehousehq.dev');
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('is null until the staff member sets it, then lets them set their own selfie', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);
    expect(loginResponse.body.user.photoUrl).toBeNull();

    const updated = await request(app.getHttpServer())
      .patch('/users/me/photo')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ photoUrl: 'https://example.com/selfie.jpg' })
      .expect(200);
    expect(updated.body.photoUrl).toBe('https://example.com/selfie.jpg');
    expect(updated.body.id).toBe(staff.id);

    const after = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);
    expect(after.body.user.photoUrl).toBe('https://example.com/selfie.jpg');
  });

  it('rejects an empty photoUrl', () => {
    return request(app.getHttpServer())
      .patch('/users/me/photo')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ photoUrl: '' })
      .expect(400);
  });
});
