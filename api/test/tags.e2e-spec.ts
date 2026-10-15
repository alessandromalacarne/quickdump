import type { INestApplication } from '@nestjs/common';
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

describe('listing tags', () => {
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

describe('deleting tags', () => {
  it('deletes a tag without deleting its dumps', async () => {
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#casa buy coffee' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/dumps')
      .send({ content: '#trabalho write the report' })
      .expect(201);

    const tags = await request(app.getHttpServer()).get('/tags').expect(200);
    const casa = tags.body.find((tag: { name: string }) => tag.name === 'casa');

    await request(app.getHttpServer()).delete(`/tags/${casa.id}`).expect(204);

    const remainingTags = await request(app.getHttpServer())
      .get('/tags')
      .expect(200);
    expect(remainingTags.body.map((tag: { name: string }) => tag.name)).toEqual(
      ['trabalho'],
    );

    const dumps = await request(app.getHttpServer()).get('/dumps').expect(200);
    expect(dumps.body.map((dump: { content: string }) => dump.content)).toEqual(
      ['#trabalho write the report', '#casa buy coffee'],
    );
    expect(dumps.body[1].tags).toEqual([]);
  });

  it('returns 404 when deleting a tag that does not exist', async () => {
    await request(app.getHttpServer())
      .delete('/tags/01920000-0000-7000-8000-000000000000')
      .expect(404);
  });
});
