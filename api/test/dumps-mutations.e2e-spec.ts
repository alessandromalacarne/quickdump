import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, truncateAll } from './test-app.js';

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

describe('rejecting an invalid update', () => {
  it('rejects an update without any deck and keeps the dump untouched', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: 'buy coffee @casa' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/dumps/${created.body.id}`)
      .send({ content: 'text without a deck' })
      .expect(400);

    expect(response.body.message).toBe(
      'Include at least one @deck in the dump',
    );

    const dumps = await request(app.getHttpServer()).get('/dumps').expect(200);

    expect(dumps.body).toMatchObject([
      { id: created.body.id, content: 'buy coffee' },
    ]);
  });

  it('rejects an update whose whole body is the marker', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: 'buy coffee @casa' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/dumps/${created.body.id}`)
      .send({ content: '@casa' })
      .expect(400);

    expect(response.body.message).toBe('The dump needs text besides the @deck');

    const dumps = await request(app.getHttpServer()).get('/dumps').expect(200);

    expect(dumps.body).toMatchObject([
      { id: created.body.id, content: 'buy coffee' },
    ]);
  });

  it('rejects empty or blank content', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: 'buy coffee @casa' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/dumps/${created.body.id}`)
      .send({ content: '' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/dumps/${created.body.id}`)
      .send({ content: '   ' })
      .expect(400);
  });

  it('returns 404 for an unknown dump', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/dumps/${randomUUID()}`)
      .send({ content: 'buy coffee @casa' })
      .expect(404);

    expect(response.body.message).toBe('Dump not found');
  });
});

describe('deleting a dump', () => {
  it('removes the dump from the lists', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: 'buy coffee @casa' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/dumps/${created.body.id}`)
      .expect(204);

    const all = await request(app.getHttpServer()).get('/dumps').expect(200);

    expect(all.body).toEqual([]);

    const byDeck = await request(app.getHttpServer())
      .get('/dumps?deck=casa')
      .expect(200);

    expect(byDeck.body).toEqual([]);
  });

  it('returns 404 for an unknown dump', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/dumps/${randomUUID()}`)
      .expect(404);

    expect(response.body.message).toBe('Dump not found');
  });

  it('keeps the decks other dumps still use and drops the empty ones', async () => {
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: 'item one @casa @trabalho' })
      .expect(201);

    const removed = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: 'item two @lazer' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/dumps/${removed.body.id}`)
      .expect(204);

    const decks = await request(app.getHttpServer()).get('/decks').expect(200);

    expect(decks.body).toEqual([
      { id: expect.any(String), name: 'casa', count: 1 },
      { id: expect.any(String), name: 'trabalho', count: 1 },
    ]);
  });
});
