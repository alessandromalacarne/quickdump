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

describe('creating a workflow', () => {
  it('creates an event workflow scoped to a deck', async () => {
    const response = await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'notify casa',
        event: 'dumpCreated',
        action: 'script',
        config: { script: 'hello.sh' },
        decks: ['Casa'],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'notify casa',
      enabled: true,
      event: 'dumpCreated',
      cron: null,
      nextRunAt: null,
      action: 'script',
      config: { script: 'hello.sh' },
      decks: [{ name: 'casa' }],
    });
    expect(response.body.id).toEqual(expect.any(String));
  });

  it('creates a scheduled workflow and arms its next run', async () => {
    const response = await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'daily export',
        cron: '59 23 * * *',
        timezone: 'America/Sao_Paulo',
        action: 'export',
        config: { window: 'day' },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      cron: '59 23 * * *',
      timezone: 'America/Sao_Paulo',
      event: null,
      decks: [],
    });
    expect(new Date(response.body.nextRunAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(response.body.nextRunAt).not.toBeNull();
  });
});

describe('defaulting the timezone', () => {
  it('defaults the timezone of a scheduled workflow to the server one', async () => {
    const response = await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'hourly',
        cron: '0 * * * *',
        action: 'export',
        config: {},
      })
      .expect(201);

    expect(response.body.timezone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});

describe('rejecting an invalid workflow', () => {
  it('rejects a workflow without a trigger', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .send({ name: 'nothing', action: 'export', config: {} })
      .expect(400);
  });

  it('rejects a workflow with both triggers', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'both',
        event: 'dumpCreated',
        cron: '0 * * * *',
        action: 'export',
        config: {},
      })
      .expect(400);
  });

  it('rejects an invalid cron expression', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'bad cron',
        cron: 'todo dia as 23:59',
        action: 'export',
        config: {},
      })
      .expect(400);
  });

  it('rejects an unknown event', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'unknown event',
        event: 'deckRenamed',
        action: 'export',
        config: {},
      })
      .expect(400);
  });
});

describe('rejecting an invalid action config', () => {
  it('rejects a script that lives outside the scripts directory', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'escape',
        event: 'dumpCreated',
        action: 'script',
        config: { script: '../../etc/passwd.sh' },
      })
      .expect(400);
  });

  it('rejects an unknown export window', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'bad window',
        cron: '0 0 * * *',
        action: 'export',
        config: { window: 'hourly' },
      })
      .expect(400);
  });
});

describe('listing workflows', () => {
  it('returns an empty list when there are none', async () => {
    const response = await request(app.getHttpServer())
      .get('/workflows')
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('lists the workflows with their decks', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'first',
        event: 'dumpCreated',
        action: 'script',
        config: { script: 'hello.sh' },
        decks: ['casa'],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/workflows')
      .send({
        name: 'second',
        event: 'deckDeleted',
        action: 'script',
        config: { script: 'hello.sh' },
        decks: ['trabalho'],
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/workflows')
      .expect(200);

    expect(
      response.body.map((workflow: { name: string }) => workflow.name),
    ).toEqual(['first', 'second']);
    expect(response.body[0].decks).toEqual([
      { id: expect.any(String), name: 'casa' },
    ]);
  });
});

describe('updating a workflow', () => {
  it('disables a workflow and drops its next run', async () => {
    const workflow = await createScheduledWorkflow();

    const response = await request(app.getHttpServer())
      .patch(`/workflows/${workflow.id}`)
      .send({ enabled: false })
      .expect(200);

    expect(response.body.enabled).toBe(false);
    expect(response.body.nextRunAt).toBeNull();
  });

  it('re-arms the next run when it is enabled again', async () => {
    const workflow = await createScheduledWorkflow();
    await request(app.getHttpServer())
      .patch(`/workflows/${workflow.id}`)
      .send({ enabled: false })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/workflows/${workflow.id}`)
      .send({ enabled: true })
      .expect(200);

    expect(new Date(response.body.nextRunAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('replaces the deck scope', async () => {
    const workflow = await createScheduledWorkflow();

    const response = await request(app.getHttpServer())
      .patch(`/workflows/${workflow.id}`)
      .send({ decks: ['trabalho'] })
      .expect(200);

    expect(response.body.decks).toEqual([
      { id: expect.any(String), name: 'trabalho' },
    ]);
  });

  it('validates the config against the new action', async () => {
    const workflow = await createScheduledWorkflow();

    await request(app.getHttpServer())
      .patch(`/workflows/${workflow.id}`)
      .send({ action: 'script', config: { script: 'no-extension' } })
      .expect(400);
  });

  it('returns 404 for an unknown workflow', async () => {
    await request(app.getHttpServer())
      .patch('/workflows/01920000-0000-7000-8000-000000000000')
      .send({ enabled: false })
      .expect(404);
  });
});

describe('deleting a workflow', () => {
  it('deletes the workflow and its runs', async () => {
    const workflow = await createScheduledWorkflow();
    await prisma.workflowRun.create({
      data: { workflowId: workflow.id, trigger: { kind: 'manual' } },
    });

    await request(app.getHttpServer())
      .delete(`/workflows/${workflow.id}`)
      .expect(204);

    expect(await prisma.workflow.count()).toBe(0);
    expect(await prisma.workflowRun.count()).toBe(0);
  });

  it('returns 404 for an unknown workflow', async () => {
    await request(app.getHttpServer())
      .delete('/workflows/01920000-0000-7000-8000-000000000000')
      .expect(404);
  });
});

async function createScheduledWorkflow(): Promise<{ id: string }> {
  const response = await request(app.getHttpServer())
    .post('/workflows')
    .send({
      name: 'daily export',
      cron: '59 23 * * *',
      timezone: 'America/Sao_Paulo',
      action: 'export',
      config: { window: 'day' },
    })
    .expect(201);

  return response.body;
}
