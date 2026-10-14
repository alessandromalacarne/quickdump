import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, truncateAll } from './test-app.js';

describe('Dumps (e2e)', () => {
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

    expect(response.body.message).toBe(
      'Include at least one #tag in the dump',
    );
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
