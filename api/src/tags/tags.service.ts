import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const { count } = await this.prisma.tag.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundException('Tag not found');
    }
  }
}
