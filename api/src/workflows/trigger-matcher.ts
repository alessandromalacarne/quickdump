import type { WorkflowEvent } from '../generated/prisma/enums.js';
import type { EventTrigger } from './trigger.js';

export interface TriggerWorkflow {
  enabled: boolean;
  event: WorkflowEvent | null;
  tags: { name: string }[];
}

function scopeMatches(tagNames: string[], scope: { name: string }[]): boolean {
  if (scope.length === 0) {
    return true;
  }

  const wanted = new Set(scope.map((tag) => tag.name.toLowerCase()));
  return tagNames.some((name) => wanted.has(name.toLowerCase()));
}

export function matchesWorkflow(
  workflow: TriggerWorkflow,
  trigger: EventTrigger,
): boolean {
  if (!workflow.enabled || workflow.event !== trigger.kind) {
    return false;
  }

  const tagNames =
    trigger.kind === 'dumpCreated' ? trigger.dump.tagNames : [trigger.tag.name];

  return scopeMatches(tagNames, workflow.tags);
}
