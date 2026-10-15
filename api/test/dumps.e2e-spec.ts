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

describe('creating a dump', () => {
  it('creates a dump with the tag extracted from the content', async () => {
    const response = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa buy coffee' })
      .expect(201);

    expect(response.body).toMatchObject({
      content: '#casa buy coffee',
      tags: [{ name: 'casa' }],
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
  });

  it('reuses the existing tag instead of duplicating it', async () => {
    const first = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#Casa buy coffee' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa clean kitchen' })
      .expect(201);

    expect(first.body.tags).toEqual([{ id: expect.any(String), name: 'casa' }]);
    expect(second.body.tags).toEqual([
      { id: first.body.tags[0].id, name: 'casa' },
    ]);
  });

  it('rejects a dump without any tag', async () => {
    const response = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: 'text without a tag' })
      .expect(400);

    expect(response.body.message).toBe('Include at least one #tag in the dump');
  });

  it('rejects empty or blank content', async () => {
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '   ' })
      .expect(400);
  });
});

describe('listing dumps', () => {
  it('lists dumps newest first', async () => {
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa first' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa second' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/dumps')
      .expect(200);

    expect(
      response.body.map((dump: { content: string }) => dump.content),
    ).toEqual(['#casa second', '#casa first']);
    expect(response.body[0].tags).toEqual([
      { id: expect.any(String), name: 'casa' },
    ]);
  });

  it('filters dumps by tag, ignoring case', async () => {
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa home item' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#trabalho work item' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#Casa another item' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/dumps?tag=Casa')
      .expect(200);

    expect(
      response.body.map((dump: { content: string }) => dump.content),
    ).toEqual(['#Casa another item', '#casa home item']);
  });
});

describe('updating a dump', () => {
  it('updates the content and keeps the creation date', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa buy coffee' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/dumps/${created.body.id}`)
      .send({ content: '#casa buy tea' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      content: '#casa buy tea',
      createdAt: created.body.createdAt,
    });
    expect(response.body.tags).toEqual([
      { id: created.body.tags[0].id, name: 'casa' },
    ]);
  });

  it('replaces the tags that are no longer in the content', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa #trabalho buy coffee' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/dumps/${created.body.id}`)
      .send({ content: '#trabalho buy coffee' })
      .expect(200);

    expect(response.body.tags).toEqual([
      { id: expect.any(String), name: 'trabalho' },
    ]);

    const tags = await request(app.getHttpServer()).get('/tags').expect(200);

    expect(tags.body).toEqual([
      { id: expect.any(String), name: 'trabalho', count: 1 },
    ]);
  });

  it('connects the tags added to the content', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa buy coffee' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/dumps/${created.body.id}`)
      .send({ content: '#casa buy coffee #urgente' })
      .expect(200);

    expect(
      response.body.tags.map((tag: { name: string }) => tag.name).sort(),
    ).toEqual(['casa', 'urgente']);

    const tags = await request(app.getHttpServer()).get('/tags').expect(200);

    expect(tags.body).toEqual([
      { id: expect.any(String), name: 'casa', count: 1 },
      { id: expect.any(String), name: 'urgente', count: 1 },
    ]);
  });

  it('rejects an update without any tag and keeps the dump untouched', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa buy coffee' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/dumps/${created.body.id}`)
      .send({ content: 'text without a tag' })
      .expect(400);

    expect(response.body.message).toBe('Include at least one #tag in the dump');

    const dumps = await request(app.getHttpServer()).get('/dumps').expect(200);

    expect(dumps.body).toMatchObject([
      { id: created.body.id, content: '#casa buy coffee' },
    ]);
  });

  it('rejects empty or blank content', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa buy coffee' })
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
      .send({ content: '#casa buy coffee' })
      .expect(404);

    expect(response.body.message).toBe('Dump not found');
  });
});

describe('deleting a dump', () => {
  it('removes the dump from the lists', async () => {
    const created = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa buy coffee' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/dumps/${created.body.id}`)
      .expect(204);

    const all = await request(app.getHttpServer()).get('/dumps').expect(200);

    expect(all.body).toEqual([]);

    const byTag = await request(app.getHttpServer())
      .get('/dumps?tag=casa')
      .expect(200);

    expect(byTag.body).toEqual([]);
  });

  it('returns 404 for an unknown dump', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/dumps/${randomUUID()}`)
      .expect(404);

    expect(response.body.message).toBe('Dump not found');
  });

  it('keeps the tags other dumps still use and drops the empty ones', async () => {
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa #trabalho item one' })
      .expect(201);

    const removed = await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#lazer item two' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/dumps/${removed.body.id}`)
      .expect(204);

    const tags = await request(app.getHttpServer()).get('/tags').expect(200);

    expect(tags.body).toEqual([
      { id: expect.any(String), name: 'casa', count: 1 },
      { id: expect.any(String), name: 'trabalho', count: 1 },
    ]);
  });
});
