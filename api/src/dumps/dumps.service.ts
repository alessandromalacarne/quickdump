import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDumpDto } from './dto/create-dump.dto.js';
import type { UpdateDumpDto } from './dto/update-dump.dto.js';
import { extractTags } from './tag-parser.js';

@Injectable()
export class DumpsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDumpDto) {
    return this.prisma.dump.create({
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

    return this.prisma.$transaction(async (tx) => {
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

      await tx.tag.deleteMany({ where: { dumps: { none: {} } } });

      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.dump.deleteMany({ where: { id } });

      if (count === 0) {
        throw new NotFoundException('Dump not found');
      }

      await tx.tag.deleteMany({ where: { dumps: { none: {} } } });
    });
  }

  private tagNamesFrom(content: string): string[] {
    const tagNames = extractTags(content);
    if (tagNames.length === 0) {
      throw new BadRequestException('Include at least one #tag in the dump');
    }

    return tagNames;
  }
}
