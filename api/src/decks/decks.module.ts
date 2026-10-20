import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { DecksController } from './decks.controller.js';
import { DecksService } from './decks.service.js';

@Module({
  imports: [WorkflowsModule],
  controllers: [DecksController],
  providers: [DecksService],
})
export class DecksModule {}
