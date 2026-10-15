import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkflowDispatcherService } from '../workflows/workflow-dispatcher.service.js';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: WorkflowDispatcherService,
  ) {}

  async list() {
    const tags = await this.prisma.tag.findMany({
      include: { _count: { select: { dumps: true } } },
      orderBy: [{ dumps: { _count: 'desc' } }, { name: 'asc' }],
    });

    return tags.map(({ id, name, _count }) => ({
      id,
      name,
      count: _count.dumps,
    }));
  }

  async remove(id: string): Promise<void> {
    const tag = await this.prisma.tag.findUnique({ where: { id } });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.prisma.tag.delete({ where: { id } });

    void this.dispatcher.dispatch({
      kind: 'tagDeleted',
      occurredAt: new Date().toISOString(),
      tag: { id: tag.id, name: tag.name },
    });
  }
}
