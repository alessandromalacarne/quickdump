import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextRun } from './cron.js';
import { WorkflowRunnerService } from './workflow-runner.service.js';

const POLL_INTERVAL_MS = 30_000;

@Injectable()
export class WorkflowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: WorkflowRunnerService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.QUICKDUMP_SCHEDULER === 'off') {
      return;
    }

    await this.armPending();
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.ticking) {
      return;
    }

    this.ticking = true;

    try {
      await this.runDue();
    } finally {
      this.ticking = false;
    }
  }

  // Workflows that carry a cron but no armed run (created while the scheduler
  // was off) start counting from now, never from a window in the past.
  private async armPending(): Promise<void> {
    const pending = await this.prisma.workflow.findMany({
      where: { enabled: true, cron: { not: null }, nextRunAt: null },
    });

    for (const workflow of pending) {
      await this.prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          nextRunAt: nextRun(workflow.cron!, workflow.timezone, new Date()),
        },
      });
    }
  }

  private async runDue(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.workflow.findMany({
      where: { enabled: true, cron: { not: null }, nextRunAt: { lte: now } },
    });

    for (const workflow of due) {
      // The claim keeps a second tick from running the same occurrence twice.
      const { count } = await this.prisma.workflow.updateMany({
        where: { id: workflow.id, nextRunAt: workflow.nextRunAt },
        data: {
          nextRunAt: nextRun(workflow.cron!, workflow.timezone, now),
          lastRunAt: now,
        },
      });

      if (count === 0) {
        continue;
      }

      const from = workflow.lastRunAt ?? workflow.nextRunAt ?? now;

      await this.runner.enqueue(workflow.id, {
        kind: 'schedule',
        occurredAt: now.toISOString(),
        window: { from: from.toISOString(), to: now.toISOString() },
      });
    }
  }
}
