import type { INestApplication } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { WorkflowSchedulerService } from '../src/workflows/workflow-scheduler.service.js';
import { createTestApp, truncateAll } from './test-app.js';

interface WorkflowRunBody {
  id: string;
  status: string;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
  outputFile: string | null;
  trigger: { kind: string; dump?: { id: string; tagNames: string[] } };
}

let app: INestApplication;
let prisma: PrismaService;
let exportsDirectory: string;

beforeAll(async () => {
  exportsDirectory = await mkdtemp(join(tmpdir(), 'quickdump-e2e-'));
  process.env.QUICKDUMP_SCRIPTS_DIR = join(
    import.meta.dirname,
    'fixtures',
    'scripts',
  );
  process.env.QUICKDUMP_EXPORT_DIR = exportsDirectory;

  ({ app, prisma } = await createTestApp());
});

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await app.close();
  await rm(exportsDirectory, { recursive: true, force: true });
  delete process.env.QUICKDUMP_SCRIPTS_DIR;
  delete process.env.QUICKDUMP_EXPORT_DIR;
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
      tags: ['casa'],
    });

    const dumpId = await createDump('#casa buy coffee');
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
      dump: { id: dumpId, tagNames: ['casa'] },
    });
  });

  it('hands the dump to the script', async () => {
    const workflow = await createWorkflow({
      name: 'echo payload',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'payload.sh', args: ['--quiet'] },
      tags: ['casa'],
    });

    const dumpId = await createDump('#casa buy coffee');
    const run = await waitForRun(workflow.id);

    expect(run.stdout).toContain('event=dumpCreated');
    expect(run.stdout).toContain('tags=casa');
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
      tags: ['casa'],
    });
    const second = await createWorkflow({
      name: 'second',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
    });

    await createDump('#casa buy coffee');

    expect((await waitForRun(first.id)).status).toBe('success');
    expect((await waitForRun(second.id)).status).toBe('success');
  });

  it('skips a workflow scoped to another tag', async () => {
    const matching = await createWorkflow({
      name: 'casa',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
      tags: ['casa'],
    });
    const other = await createWorkflow({
      name: 'trabalho',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'hello.sh' },
      tags: ['trabalho'],
    });

    await createDump('#casa buy coffee');
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
      tags: ['casa'],
    });
    await request(app.getHttpServer())
      .patch(`/workflows/${workflow.id}`)
      .send({ enabled: false })
      .expect(200);

    await createDump('#casa buy coffee');
    await settle();

    expect(await runsOf(workflow.id)).toEqual([]);
  });

  it('records a failed run without failing the dump', async () => {
    const workflow = await createWorkflow({
      name: 'fails',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'fail.sh' },
      tags: ['casa'],
    });

    await createDump('#casa buy coffee');
    const run = await waitForRun(workflow.id);

    expect(run).toMatchObject({
      status: 'failed',
      exitCode: 3,
      stderr: 'about to fail\n',
      error: 'Script exited with code 3',
    });
  });
});

describe('running a workflow when a tag is deleted', () => {
  it('runs the workflows scoped to that tag', async () => {
    const workflow = await createWorkflow({
      name: 'tag deleted',
      event: 'tagDeleted',
      action: 'script',
      config: { script: 'hello.sh' },
      tags: ['casa'],
    });
    await createDump('#casa buy coffee');
    const tags = await request(app.getHttpServer()).get('/tags').expect(200);
    const casa = tags.body.find((tag: { name: string }) => tag.name === 'casa');

    await request(app.getHttpServer()).delete(`/tags/${casa.id}`).expect(204);

    const run = await waitForRun(workflow.id);
    expect(run.status).toBe('success');
    expect(run.trigger).toMatchObject({
      kind: 'tagDeleted',
      tag: { id: casa.id, name: 'casa' },
    });
  });

  it('ignores a tag outside the workflow scope', async () => {
    const workflow = await createWorkflow({
      name: 'tag deleted',
      event: 'tagDeleted',
      action: 'script',
      config: { script: 'hello.sh' },
      tags: ['casa'],
    });
    await createDump('#trabalho write the report');
    const tags = await request(app.getHttpServer()).get('/tags').expect(200);
    const trabalho = tags.body.find(
      (tag: { name: string }) => tag.name === 'trabalho',
    );

    await request(app.getHttpServer())
      .delete(`/tags/${trabalho.id}`)
      .expect(204);
    await settle();

    expect(await runsOf(workflow.id)).toEqual([]);
  });
});

describe('running a workflow when an edit leaves a tag without dumps', () => {
  it('runs the workflows scoped to the tag that dropped out', async () => {
    const workflow = await createWorkflow({
      name: 'tag dropped by an edit',
      event: 'tagDeleted',
      action: 'script',
      config: { script: 'hello.sh' },
      tags: ['casa'],
    });
    const dumpId = await createDump('#casa buy coffee');

    await request(app.getHttpServer())
      .patch(`/dumps/${dumpId}`)
      .send({ content: '#trabalho buy coffee' })
      .expect(200);

    const run = await waitForRun(workflow.id, 'tagDeleted');
    expect(run.status).toBe('success');
    expect(run.trigger).toMatchObject({
      kind: 'tagDeleted',
      tag: { name: 'casa' },
    });
  });

  it('runs them when the last dump of the tag is deleted', async () => {
    const workflow = await createWorkflow({
      name: 'tag dropped by a delete',
      event: 'tagDeleted',
      action: 'script',
      config: { script: 'hello.sh' },
      tags: ['casa'],
    });
    const dumpId = await createDump('#casa buy coffee');

    await request(app.getHttpServer()).delete(`/dumps/${dumpId}`).expect(204);

    const run = await waitForRun(workflow.id, 'tagDeleted');
    expect(run.status).toBe('success');
    expect(run.trigger).toMatchObject({
      kind: 'tagDeleted',
      tag: { name: 'casa' },
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
      tags: ['casa'],
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

describe('running an export workflow', () => {
  it('writes the dumps of the tag scope to a text file', async () => {
    const workflow = await createWorkflow({
      name: 'export casa',
      event: 'dumpCreated',
      action: 'export',
      config: { window: 'all' },
      tags: ['casa'],
    });
    await createDump('#casa buy coffee');
    await createDump('#casa clean kitchen');
    await createDump('#trabalho write the report');

    await request(app.getHttpServer())
      .post(`/workflows/${workflow.id}/run`)
      .expect(202);
    // The dumps above run this workflow as well, so wait for the manual run.
    const run = await waitForRun(workflow.id, 'manual');

    expect(run.status).toBe('success');
    expect(run.outputFile).toContain(exportsDirectory);

    const content = await readFile(run.outputFile!, 'utf8');
    expect(content).toContain('#casa buy coffee');
    expect(content).toContain('#casa clean kitchen');
    expect(content).not.toContain('write the report');
  });

  it('writes nothing when the window has no dumps', async () => {
    const workflow = await createWorkflow({
      name: 'export nothing',
      event: 'dumpCreated',
      action: 'export',
      config: { window: 'all' },
      tags: ['casa'],
    });

    await request(app.getHttpServer())
      .post(`/workflows/${workflow.id}/run`)
      .expect(202);
    const run = await waitForRun(workflow.id, 'manual');

    expect(run).toMatchObject({
      status: 'success',
      outputFile: null,
      stdout: 'no dumps in the window',
    });
  });
});

describe('running scheduled workflows', () => {
  it('runs the workflows that are due and arms the next run', async () => {
    const workflow = await createWorkflow({
      name: 'every five minutes',
      cron: '*/5 * * * *',
      action: 'export',
      config: { window: 'sinceLastRun' },
      tags: ['casa'],
    });
    await createDump('#casa buy coffee');
    await makeDue(workflow.id);

    await scheduler().tick();

    const run = await waitForRun(workflow.id, 'schedule');
    expect(run.status).toBe('success');
    expect(await readFile(run.outputFile!, 'utf8')).toContain(
      '#casa buy coffee',
    );

    const armed = await prisma.workflow.findUniqueOrThrow({
      where: { id: workflow.id },
    });
    expect(armed.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(armed.lastRunAt).not.toBeNull();
  });

  it('catches up on the window missed while the api was down', async () => {
    const workflow = await createWorkflow({
      name: 'daily export',
      cron: '0 0 * * *',
      action: 'export',
      config: { window: 'sinceLastRun' },
      tags: ['casa'],
    });
    await prisma.dump.create({
      data: {
        content: '#casa written while the api was down',
        createdAt: daysAgo(2),
        tags: {
          connectOrCreate: [
            { where: { name: 'casa' }, create: { name: 'casa' } },
          ],
        },
      },
    });
    await makeDue(workflow.id, daysAgo(3));

    await scheduler().tick();

    const run = await waitForRun(workflow.id, 'schedule');
    expect(await readFile(run.outputFile!, 'utf8')).toContain(
      'written while the api was down',
    );
  });
});

describe('leaving a schedule alone', () => {
  it('leaves workflows that are not due alone', async () => {
    const workflow = await createWorkflow({
      name: 'tomorrow',
      cron: '0 0 * * *',
      action: 'export',
      config: { window: 'sinceLastRun' },
      tags: ['casa'],
    });

    await scheduler().tick();
    await settle();

    expect(await runsOf(workflow.id)).toEqual([]);
  });
});

function scheduler(): WorkflowSchedulerService {
  return app.get(WorkflowSchedulerService);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function makeDue(workflowId: string, at = new Date(Date.now() - 60_000)) {
  await prisma.workflow.update({
    where: { id: workflowId },
    data: { nextRunAt: at },
  });
}
