import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { WorkflowAction, WorkflowEvent } from '../../generated/prisma/enums.js';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(Object.values(WorkflowEvent))
  event?: WorkflowEvent;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cron?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsIn(Object.values(WorkflowAction))
  action!: WorkflowAction;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
