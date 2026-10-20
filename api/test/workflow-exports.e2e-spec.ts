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
  trigger: { kind: string; dump?: { id: string; deckNames: string[] } };
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
describe('running an export workflow', () => {
  it('writes the dumps of the deck scope to a text file', async () => {
    const workflow = await createWorkflow({
      name: 'export casa',
      event: 'dumpCreated',
      action: 'export',
      config: { window: 'all' },
      decks: ['casa'],
    });
    await createDump('buy coffee @casa');
    await createDump('clean kitchen @casa');
    await createDump('write the report @trabalho');

    await request(app.getHttpServer())
      .post(`/workflows/${workflow.id}/run`)
      .expect(202);
    // The dumps above run this workflow as well, so wait for the manual run.
    const run = await waitForRun(workflow.id, 'manual');

    expect(run.status).toBe('success');
    expect(run.outputFile).toContain(exportsDirectory);

    const content = await readFile(run.outputFile!, 'utf8');
    expect(content).toContain('@casa\nbuy coffee');
    expect(content).toContain('@casa\nclean kitchen');
    expect(content).not.toContain('write the report');
  });

  it('writes nothing when the window has no dumps', async () => {
    const workflow = await createWorkflow({
      name: 'export nothing',
      event: 'dumpCreated',
      action: 'export',
      config: { window: 'all' },
      decks: ['casa'],
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
      decks: ['casa'],
    });
    await createDump('buy coffee @casa');
    await makeDue(workflow.id);

    await scheduler().tick();

    const run = await waitForRun(workflow.id, 'schedule');
    expect(run.status).toBe('success');
    expect(await readFile(run.outputFile!, 'utf8')).toContain(
      '@casa\nbuy coffee',
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
      decks: ['casa'],
    });
    await prisma.dump.create({
      data: {
        content: 'written while the api was down',
        createdAt: daysAgo(2),
        decks: {
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
      decks: ['casa'],
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
