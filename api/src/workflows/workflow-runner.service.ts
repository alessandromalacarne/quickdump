import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseExportConfig, parseScriptConfig } from './workflow-config.js';
import {
  resolveExportWindow,
  runExportAction,
} from './actions/export.action.js';
import { runScriptAction } from './actions/script.action.js';
import { ScriptsService } from './scripts.service.js';
import type { WorkflowTrigger } from './trigger.js';
import type { WorkflowWithDecks } from './workflow.types.js';
import { asJsonInput } from './workflow.types.js';
import type { RunStatus } from '../generated/prisma/enums.js';

interface QueuedRun {
  runId: string;
  workflowId: string;
  trigger: WorkflowTrigger;
}

interface RunOutcome {
  status: RunStatus;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
  outputFile: string | null;
}

@Injectable()
export class WorkflowRunnerService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowRunnerService.name);
  private readonly queue: QueuedRun[] = [];
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scripts: ScriptsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Runs left open by a crashed instance can never finish on their own.
    await this.prisma.workflowRun.updateMany({
      where: { status: { in: ['pending', 'running'] } },
      data: {
        status: 'interrupted',
        error: 'Interrupted by a restart',
        finishedAt: new Date(),
      },
    });
  }

  async enqueue(workflowId: string, trigger: WorkflowTrigger): Promise<string> {
    const run = await this.prisma.workflowRun.create({
      data: { workflowId, trigger: asJsonInput(trigger), status: 'pending' },
    });

    this.queue.push({ runId: run.id, workflowId, trigger });
    void this.drain();

    return run.id;
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      return;
    }

    this.draining = true;

    try {
      for (let item = this.queue.shift(); item; item = this.queue.shift()) {
        try {
          await this.execute(item);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `run ${item.runId} could not be executed: ${message}`,
          );
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async execute(item: QueuedRun): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: item.workflowId },
      include: { decks: true },
    });

    if (!workflow) {
      await this.settle(item.runId, {
        status: 'failed',
        error: 'Workflow no longer exists',
      });
      return;
    }

    const claimed = await this.prisma.workflowRun.updateMany({
      where: { id: item.runId, status: 'pending' },
      data: { status: 'running' },
    });

    // The row is gone: the workflow was deleted, or the database was reset.
    if (claimed.count === 0) {
      return;
    }

    try {
      const outcome = await this.runAction(workflow, item.trigger);
      await this.settle(item.runId, outcome);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`workflow ${workflow.name} failed: ${message}`);

      await this.settle(item.runId, { status: 'failed', error: message });
    }
  }

  private async settle(
    runId: string,
    outcome: Partial<RunOutcome>,
  ): Promise<void> {
    await this.prisma.workflowRun.updateMany({
      where: { id: runId },
      data: { ...outcome, finishedAt: new Date() },
    });
  }

  private runAction(
    workflow: WorkflowWithDecks,
    trigger: WorkflowTrigger,
  ): Promise<RunOutcome> {
    return workflow.action === 'script'
      ? this.runScript(workflow, trigger)
      : this.runExport(workflow, trigger);
  }

  private async runScript(
    workflow: WorkflowWithDecks,
    trigger: WorkflowTrigger,
  ): Promise<RunOutcome> {
    const config = parseScriptConfig(workflow.config);
    const result = await runScriptAction({
      scriptPath: await this.scripts.resolve(config.script),
      args: config.args,
      cwd: config.cwd,
      timeoutMs: config.timeoutMs,
      env: scriptEnvironment(workflow, trigger),
      payload: {
        workflow: { id: workflow.id, name: workflow.name },
        trigger,
      },
    });

    const failed = result.exitCode !== 0 || result.error !== undefined;

    return {
      status: failed ? 'failed' : 'success',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      error:
        result.error ??
        (result.exitCode === 0
          ? null
          : `Script exited with code ${result.exitCode}`),
      outputFile: null,
    };
  }

  private async runExport(
    workflow: WorkflowWithDecks,
    trigger: WorkflowTrigger,
  ): Promise<RunOutcome> {
    const config = parseExportConfig(workflow.config);
    const window = resolveExportWindow({
      window: config.window,
      timezone: workflow.timezone,
      now: new Date(),
      lastRunAt: workflow.lastRunAt,
      triggerWindow: trigger.kind === 'schedule' ? trigger.window : undefined,
    });
    const deckNames = workflow.decks.map((deck) => deck.name);
    const dumps = await this.prisma.dump.findMany({
      where: {
        createdAt: { gte: window.from, lt: window.to },
        ...(deckNames.length > 0
          ? { decks: { some: { name: { in: deckNames } } } }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { decks: true },
    });
    const result = await runExportAction({
      dumps,
      config,
      window,
      timezone: workflow.timezone,
    });

    return {
      status: 'success',
      exitCode: null,
      stdout: result.stdout,
      stderr: null,
      error: null,
      outputFile: result.outputFile ?? null,
    };
  }
}

function scriptEnvironment(
  workflow: WorkflowWithDecks,
  trigger: WorkflowTrigger,
): Record<string, string> {
  const env: Record<string, string> = {
    QUICKDUMP_EVENT: trigger.kind,
    QUICKDUMP_WORKFLOW_ID: workflow.id,
    QUICKDUMP_WORKFLOW_NAME: workflow.name,
  };

  if (trigger.kind === 'dumpCreated') {
    env.QUICKDUMP_DUMP_ID = trigger.dump.id;
    env.QUICKDUMP_DECKS = trigger.dump.deckNames.join(',');
  } else if (trigger.kind === 'deckDeleted') {
    env.QUICKDUMP_DECKS = trigger.deck.name;
  } else if (trigger.kind === 'schedule') {
    env.QUICKDUMP_WINDOW_FROM = trigger.window.from;
    env.QUICKDUMP_WINDOW_TO = trigger.window.to;
  }

  return env;
}
