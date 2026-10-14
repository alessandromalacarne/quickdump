import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDumpDto } from './dto/create-dump.dto.js';
import { extractTags } from './tag-parser.js';

@Injectable()
export class DumpsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDumpDto) {
    const tagNames = extractTags(dto.content);
    if (tagNames.length === 0) {
      throw new BadRequestException('Include at least one #tag in the dump');
    }

    return this.prisma.dump.create({
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
  }

  async list(tag?: string) {
    return this.prisma.dump.findMany({
      where: tag ? { tags: { some: { name: tag.toLowerCase() } } } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { tags: true },
    });
  }
}
