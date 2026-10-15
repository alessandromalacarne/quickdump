import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowDispatcherService } from '../workflows/workflow-dispatcher.service.js';
import type { CreateDumpDto } from './dto/create-dump.dto.js';
import type { UpdateDumpDto } from './dto/update-dump.dto.js';
import { extractTags } from './tag-parser.js';

@Injectable()
export class DumpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: WorkflowDispatcherService,
  ) {}

  async create(dto: CreateDumpDto) {
    const dump = await this.prisma.dump.create({
      data: {
        content: dto.content,
        tags: {
          connectOrCreate: this.tagNamesFrom(dto.content).map((name) => ({
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

  async update(id: string, dto: UpdateDumpDto) {
    const tagNames = this.tagNamesFrom(dto.content);

    const { updated, orphanedTags } = await this.prisma.$transaction(
      async (tx) => {
        const { count } = await tx.dump.updateMany({
          where: { id },
          data: { content: dto.content },
        });

        if (count === 0) {
          throw new NotFoundException('Dump not found');
        }

        const tags = await Promise.all(
          tagNames.map((name) =>
            tx.tag.upsert({ where: { name }, update: {}, create: { name } }),
          ),
        );

        const updated = await tx.dump.update({
          where: { id },
          data: { tags: { set: tags.map(({ id: tagId }) => ({ id: tagId })) } },
          include: { tags: true },
        });

        const orphaned = await tx.tag.findMany({
          where: { dumps: { none: {} } },
        });
        await tx.tag.deleteMany({ where: { dumps: { none: {} } } });

        return { updated, orphanedTags: orphaned };
      },
    );

    this.dispatchTagDeletions(orphanedTags);

    return updated;
  }

  async remove(id: string): Promise<void> {
    const orphanedTags = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.dump.deleteMany({ where: { id } });

      if (count === 0) {
        throw new NotFoundException('Dump not found');
      }

      const orphaned = await tx.tag.findMany({
        where: { dumps: { none: {} } },
      });
      await tx.tag.deleteMany({ where: { dumps: { none: {} } } });

      return orphaned;
    });

    this.dispatchTagDeletions(orphanedTags);
  }

  private tagNamesFrom(content: string): string[] {
    const tagNames = extractTags(content);
    if (tagNames.length === 0) {
      throw new BadRequestException('Include at least one #tag in the dump');
    }

    return tagNames;
  }

  // A tag that loses its last dump is gone exactly like a deleted one, so the
  // workflows watching it hear about it the same way.
  private dispatchTagDeletions(tags: { id: string; name: string }[]): void {
    for (const tag of tags) {
      void this.dispatcher.dispatch({
        kind: 'tagDeleted',
        occurredAt: new Date().toISOString(),
        tag: { id: tag.id, name: tag.name },
      });
    }
  }
}
