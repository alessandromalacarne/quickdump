import { Module } from '@nestjs/common';
import { DumpsController } from './dumps.controller.js';
import { DumpsService } from './dumps.service.js';
import { WorkflowsModule } from '../workflows/workflows.module.js';

@Module({
  imports: [WorkflowsModule],
  controllers: [DumpsController],
  providers: [DumpsService],
})
export class DumpsModule {}
