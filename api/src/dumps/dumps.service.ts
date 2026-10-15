import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowDispatcherService } from '../workflows/workflow-dispatcher.service.js';
import type { CreateDumpDto } from './dto/create-dump.dto.js';
import { extractTags } from './tag-parser.js';

@Injectable()
export class DumpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: WorkflowDispatcherService,
  ) {}

  async create(dto: CreateDumpDto) {
    const tagNames = extractTags(dto.content);
    if (tagNames.length === 0) {
      throw new BadRequestException('Include at least one #tag in the dump');
    }

    const dump = await this.prisma.dump.create({
      data: {
        content: dto.content,
        tags: {
          connectOrCreate: tagNames.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      include: { tags: true },
    });

    void this.dispatcher.dispatch({
      kind: 'dumpCreated',
      occurredAt: new Date().toISOString(),
      dump: {
        id: dump.id,
        content: dump.content,
        tagNames: dump.tags.map((tag) => tag.name),
      },
    });

    return dump;
  }

  async list(tag?: string) {
    return this.prisma.dump.findMany({
      where: tag ? { tags: { some: { name: tag.toLowerCase() } } } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { tags: true },
    });
  }
}
