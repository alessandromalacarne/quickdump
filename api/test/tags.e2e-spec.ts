import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, truncateAll } from './test-app.js';

describe('Tags (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists tags with counts, most used first and tie-broken by name', async () => {
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa first' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa second' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#trabalho third' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#aaa fourth' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/tags')
      .expect(200);

    expect(response.body).toEqual([
      { id: expect.any(String), name: 'casa', count: 2 },
      { id: expect.any(String), name: 'aaa', count: 1 },
      { id: expect.any(String), name: 'trabalho', count: 1 },
    ]);
  });

  it('returns an empty list when there are no tags', async () => {
    const response = await request(app.getHttpServer())
      .get('/tags')
      .expect(200);

    expect(response.body).toEqual([]);
  });
});
