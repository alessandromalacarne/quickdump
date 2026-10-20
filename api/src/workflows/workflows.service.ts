import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { WorkflowAction } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextRun } from './cron.js';
import type { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import type { UpdateWorkflowDto } from './dto/update-workflow.dto.js';
import { parseActionConfig, validateTrigger } from './workflow-config.js';
import { WorkflowRunnerService } from './workflow-runner.service.js';
import { asJsonInput } from './workflow.types.js';

const DEFAULT_RUN_LIMIT = 20;
const MAX_RUN_LIMIT = 100;

interface TriggerState {
  cron: string | null;
  enabled: boolean;
  timezone: string;
}

function normalizeDecks(decks: string[] | undefined): string[] {
  return [
    ...new Set(
      (decks ?? []).map((deck) => deck.trim().toLowerCase()).filter(Boolean),
    ),
  ];
}

function deckConnections(decks: string[] | undefined) {
  return normalizeDecks(decks).map((name) => ({
    where: { name },
    create: { name },
  }));
}

function resolveNextRunAt(
  next: TriggerState,
  current: TriggerState & { nextRunAt: Date | null },
  now: Date,
): Date | null {
  if (next.cron === null || !next.enabled) {
    return null;
  }

  const unchanged =
    next.cron === current.cron &&
    next.timezone === current.timezone &&
    next.enabled === current.enabled &&
    current.nextRunAt !== null;

  return unchanged ? current.nextRunAt : nextRun(next.cron, next.timezone, now);
}

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: WorkflowRunnerService,
  ) {}

  list() {
    return this.prisma.workflow.findMany({
      include: { decks: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async create(dto: CreateWorkflowDto) {
    const event = dto.event ?? null;
    const cron = dto.cron ?? null;
    const enabled = dto.enabled ?? true;
    const timezone =
      dto.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

    validateTrigger({ event, cron, timezone });

    return this.prisma.workflow.create({
      data: {
        name: dto.name,
        enabled,
        event,
        cron,
        timezone,
        action: dto.action,
        config: asJsonInput(parseActionConfig(dto.action, dto.config)),
        nextRunAt: cron && enabled ? nextRun(cron, timezone, new Date()) : null,
        decks: { connectOrCreate: deckConnections(dto.decks) },
      },
      include: { decks: true },
    });
  }

  async update(id: string, dto: UpdateWorkflowDto) {
    const current = await this.prisma.workflow.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException('Workflow not found');
    }

    // Setting one trigger clears the other: a workflow has exactly one.
    const cron = dto.cron ?? (dto.event ? null : current.cron);
    const event = dto.cron ? null : (dto.event ?? current.event);
    const enabled = dto.enabled ?? current.enabled;
    const timezone = dto.timezone ?? current.timezone;

    validateTrigger({ event, cron, timezone });

    const action = dto.action ?? current.action;

    return this.prisma.workflow.update({
      where: { id },
      data: {
        name: dto.name ?? current.name,
        enabled,
        event,
        cron,
        timezone,
        action,
        config: this.resolveConfig(action, dto, current),
        nextRunAt: resolveNextRunAt(
          { cron, enabled, timezone },
          current,
          new Date(),
        ),
        ...(dto.decks === undefined
          ? {}
          : {
              decks: {
                set: [],
                connectOrCreate: deckConnections(dto.decks),
              },
            }),
      },
      include: { decks: true },
    });
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.prisma.workflow.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundException('Workflow not found');
    }
  }

  async listRuns(id: string, limit?: string) {
    await this.findOrFail(id);

    return this.prisma.workflowRun.findMany({
      where: { workflowId: id },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: Math.min(
        Math.max(Number(limit) || DEFAULT_RUN_LIMIT, 1),
        MAX_RUN_LIMIT,
      ),
    });
  }

  async runNow(id: string): Promise<{ runId: string }> {
    await this.findOrFail(id);

    const runId = await this.runner.enqueue(id, {
      kind: 'manual',
      occurredAt: new Date().toISOString(),
    });

    return { runId };
  }

  private async findOrFail(id: string): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id } });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
  }

  private resolveConfig(
    action: WorkflowAction,
    dto: UpdateWorkflowDto,
    current: { action: WorkflowAction; config: Prisma.JsonValue },
  ): Prisma.InputJsonValue {
    if (dto.action !== undefined && dto.action !== current.action) {
      if (dto.config === undefined) {
        throw new BadRequestException(
          'config is required when the action changes',
        );
      }

      return asJsonInput(parseActionConfig(action, dto.config));
    }

    if (dto.config !== undefined) {
      return asJsonInput(parseActionConfig(action, dto.config));
    }

    return asJsonInput(current.config);
  }
}
