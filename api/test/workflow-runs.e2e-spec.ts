import type { INestApplication } from '@nestjs/common';
import { join } from 'node:path';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, truncateAll } from './test-app.js';

interface WorkflowRunBody {
  id: string;
  status: string;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
  outputFile: string | null;
  trigger: { kind: string; dump?: { id: string; deckNames: string[] } };
}

let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  process.env.QUICKDUMP_SCRIPTS_DIR = join(
    import.meta.dirname,
    'fixtures',
    'scripts',
  );

  ({ app, prisma } = await createTestApp());
});

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await app.close();
  delete process.env.QUICKDUMP_SCRIPTS_DIR;
});

async function createWorkflow(body: Record<string, unknown>) {
  const response = await request(app.getHttpServer())
    .post('/workflows')
    .send(body)
    .expect(201);

  return response.body;
}

async function createDump(content: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/dumps')
    .send({ content })
    .expect(201);

  return response.body.id;
}

async function runsOf(workflowId: string): Promise<WorkflowRunBody[]> {
  const response = await request(app.getHttpServer())
    .get(`/workflows/${workflowId}/runs`)
    .expect(200);

  return response.body;
}

async function waitForRun(
  workflowId: string,
  kind?: string,
): Promise<WorkflowRunBody> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const settled = (await runsOf(workflowId)).filter(
      (run) =>
        run.status !== 'pending' &&
        run.status !== 'running' &&
        (kind === undefined || run.trigger.kind === kind),
    );

    if (settled.length > 0) {
      return settled[0];
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`workflow ${workflowId} did not run in time`);
}

// The dispatcher works off the request path, so give it a moment before
// asserting that something did *not* happen.
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('running a workflow when a dump arrives', () => {
  it('runs the script and records its output', async () => {
    const workflow = await createWorkflow({
      name: 'greet casa',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });

    const dumpId = await createDump('buy coffee @casa');
    const run = await waitForRun(workflow.id);

    expect(run).toMatchObject({
      status: 'success',
      exitCode: 0,
      stdout: 'hello from hello.sh\n',
      stderr: '',
      outputFile: null,
    });
    expect(run.trigger).toMatchObject({
      kind: 'dumpCreated',
      dump: { id: dumpId, deckNames: ['casa'] },
    });
  });

  it('hands the dump to the script', async () => {
    const workflow = await createWorkflow({
      name: 'echo payload',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'payload.sh', args: ['--quiet'] },
      decks: ['casa'],
    });

    const dumpId = await createDump('buy coffee @casa');
    const run = await waitForRun(workflow.id);

    expect(run.stdout).toContain('event=dumpCreated');
    expect(run.stdout).toContain('decks=casa');
    expect(run.stdout).toContain(`dump=${dumpId}`);
    expect(run.stdout).toContain('args=--quiet');
    expect(run.stdout).toContain('"name":"echo payload"');
  });
});

describe('picking which workflows run', () => {
  it('runs every workflow that matches the dump', async () => {
    const first = await createWorkflow({
      name: 'first',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });
    const second = await createWorkflow({
      name: 'second',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
    });

    await createDump('buy coffee @casa');

    expect((await waitForRun(first.id)).status).toBe('success');
    expect((await waitForRun(second.id)).status).toBe('success');
  });

  it('skips a workflow scoped to another deck', async () => {
    const matching = await createWorkflow({
      name: 'casa',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });
    const other = await createWorkflow({
      name: 'trabalho',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['trabalho'],
    });

    await createDump('buy coffee @casa');
    const run = await waitForRun(matching.id);
    await settle();

    expect(run.status).toBe('success');
    expect(await runsOf(other.id)).toEqual([]);
  });
});

describe('when a run should not or cannot happen', () => {
  it('ignores disabled workflows', async () => {
    const workflow = await createWorkflow({
      name: 'disabled',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });
    await request(app.getHttpServer())
      .patch(`/workflows/${workflow.id}`)
      .send({ enabled: false })
      .expect(200);

    await createDump('buy coffee @casa');
    await settle();

    expect(await runsOf(workflow.id)).toEqual([]);
  });

  it('records a failed run without failing the dump', async () => {
    const workflow = await createWorkflow({
      name: 'fails',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'fail.sh' },
      decks: ['casa'],
    });

    await createDump('buy coffee @casa');
    const run = await waitForRun(workflow.id);

    expect(run).toMatchObject({
      status: 'failed',
      exitCode: 3,
      stderr: 'about to fail\n',
      error: 'Script exited with code 3',
    });
  });
});

describe('running a workflow when a deck is deleted', () => {
  it('runs the workflows scoped to that deck', async () => {
    const workflow = await createWorkflow({
      name: 'deck deleted',
      event: 'deckDeleted',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });
    await createDump('buy coffee @casa');
    const decks = await request(app.getHttpServer()).get('/decks').expect(200);
    const casa = decks.body.find(
      (deck: { name: string }) => deck.name === 'casa',
    );

    await request(app.getHttpServer()).delete(`/decks/${casa.id}`).expect(204);

    const run = await waitForRun(workflow.id);
    expect(run.status).toBe('success');
    expect(run.trigger).toMatchObject({
      kind: 'deckDeleted',
      deck: { id: casa.id, name: 'casa' },
    });
  });

  it('ignores a deck outside the workflow scope', async () => {
    const workflow = await createWorkflow({
      name: 'deck deleted',
      event: 'deckDeleted',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });
    await createDump('write the report @trabalho');
    const decks = await request(app.getHttpServer()).get('/decks').expect(200);
    const trabalho = decks.body.find(
      (deck: { name: string }) => deck.name === 'trabalho',
    );

    await request(app.getHttpServer())
      .delete(`/decks/${trabalho.id}`)
      .expect(204);
    await settle();

    expect(await runsOf(workflow.id)).toEqual([]);
  });
});

describe('running a workflow when an edit leaves a deck without dumps', () => {
  it('runs the workflows scoped to the deck that dropped out', async () => {
    const workflow = await createWorkflow({
      name: 'deck dropped by an edit',
      event: 'deckDeleted',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });
    const dumpId = await createDump('buy coffee @casa');

    await request(app.getHttpServer())
      .patch(`/dumps/${dumpId}`)
      .send({ content: 'buy coffee @trabalho' })
      .expect(200);

    const run = await waitForRun(workflow.id, 'deckDeleted');
    expect(run.status).toBe('success');
    expect(run.trigger).toMatchObject({
      kind: 'deckDeleted',
      deck: { name: 'casa' },
    });
  });

  it('runs them when the last dump of the deck is deleted', async () => {
    const workflow = await createWorkflow({
      name: 'deck dropped by a delete',
      event: 'deckDeleted',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });
    const dumpId = await createDump('buy coffee @casa');

    await request(app.getHttpServer()).delete(`/dumps/${dumpId}`).expect(204);

    const run = await waitForRun(workflow.id, 'deckDeleted');
    expect(run.status).toBe('success');
    expect(run.trigger).toMatchObject({
      kind: 'deckDeleted',
      deck: { name: 'casa' },
    });
  });
});

describe('running a workflow on demand', () => {
  it('runs the workflow and reports the new run', async () => {
    const workflow = await createWorkflow({
      name: 'manual',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
      decks: ['casa'],
    });

    const response = await request(app.getHttpServer())
      .post(`/workflows/${workflow.id}/run`)
      .expect(202);

    expect(response.body.runId).toEqual(expect.any(String));

    const run = await waitForRun(workflow.id, 'manual');
    expect(run).toMatchObject({
      status: 'success',
      trigger: { kind: 'manual' },
    });
  });

  it('returns 404 for an unknown workflow', async () => {
    await request(app.getHttpServer())
      .post('/workflows/01920000-0000-7000-8000-000000000000/run')
      .expect(404);
  });
});
