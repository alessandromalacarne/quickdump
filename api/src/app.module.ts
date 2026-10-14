import { Module } from '@nestjs/common';
import { DumpsModule } from './dumps/dumps.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TagsModule } from './tags/tags.module.js';

@Module({
  imports: [PrismaModule, DumpsModule, TagsModule],
})
export class AppModule {}
