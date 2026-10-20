import { Module } from '@nestjs/common';
import { DecksModule } from './decks/decks.module.js';
import { DumpsModule } from './dumps/dumps.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';

@Module({
  imports: [PrismaModule, DumpsModule, DecksModule, WorkflowsModule],
})
export class AppModule {}
