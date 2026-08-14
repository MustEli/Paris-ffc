import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';

describe('Warehouse HQ backend (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET) health check', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      status: 'ok',
      service: 'warehouse-hq-backend',
    });
  });

  it('rejects a bad login', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects shift routes without a token', () => {
    return request(app.getHttpServer()).get('/shifts/status').expect(401);
  });

  it('logs in, then starts, checks, and ends a shift', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'staff@warehousehq.dev', password: 'password123' })
      .expect(201);

    expect(loginResponse.body.user).toMatchObject({ email: 'staff@warehousehq.dev', role: 'staff' });
    const token = loginResponse.body.accessToken as string;
    const auth = `Bearer ${token}`;

    await request(app.getHttpServer())
      .get('/shifts/status')
      .set('Authorization', auth)
      .expect(200)
      .expect({ active: false, shiftId: null, startedAt: null });

    const startResponse = await request(app.getHttpServer())
      .post('/shifts/start')
      .set('Authorization', auth)
      .expect(201);
    expect(startResponse.body.endedAt).toBeNull();

    // Starting again while already active is rejected.
    await request(app.getHttpServer()).post('/shifts/start').set('Authorization', auth).expect(409);

    const statusResponse = await request(app.getHttpServer())
      .get('/shifts/status')
      .set('Authorization', auth)
      .expect(200);
    expect(statusResponse.body.active).toBe(true);

    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', auth).expect(201);

    // Ending again with nothing active is rejected.
    await request(app.getHttpServer()).post('/shifts/end').set('Authorization', auth).expect(404);
  });
});
