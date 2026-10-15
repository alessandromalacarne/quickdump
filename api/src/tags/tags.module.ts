import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [WorkflowsModule],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
