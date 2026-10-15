import { Module } from '@nestjs/common';
import { ScriptsController } from './scripts.controller.js';
import { ScriptsService } from './scripts.service.js';
import { WorkflowDispatcherService } from './workflow-dispatcher.service.js';
import { WorkflowRunnerService } from './workflow-runner.service.js';
import { WorkflowSchedulerService } from './workflow-scheduler.service.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

@Module({
  controllers: [WorkflowsController, ScriptsController],
  providers: [
    WorkflowsService,
    WorkflowRunnerService,
    WorkflowDispatcherService,
    WorkflowSchedulerService,
    ScriptsService,
  ],
  exports: [WorkflowDispatcherService],
})
export class WorkflowsModule {}
