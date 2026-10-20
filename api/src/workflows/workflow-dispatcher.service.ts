import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { matchesWorkflow } from './trigger-matcher.js';
import type { EventTrigger } from './trigger.js';
import { WorkflowRunnerService } from './workflow-runner.service.js';

@Injectable()
export class WorkflowDispatcherService {
  private readonly logger = new Logger(WorkflowDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: WorkflowRunnerService,
  ) {}

  async dispatch(trigger: EventTrigger): Promise<void> {
    try {
      const workflows = await this.prisma.workflow.findMany({
        where: { enabled: true, event: trigger.kind },
        include: { decks: true },
      });

      for (const workflow of workflows) {
        if (matchesWorkflow(workflow, trigger)) {
          await this.runner.enqueue(workflow.id, trigger);
        }
      }
    } catch (error) {
      // A broken workflow must never break the request that triggered it.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`dispatching ${trigger.kind} failed: ${message}`);
    }
  }
}
