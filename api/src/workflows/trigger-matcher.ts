import type { WorkflowEvent } from '../generated/prisma/enums.js';
import type { EventTrigger } from './trigger.js';

export interface TriggerWorkflow {
  enabled: boolean;
  event: WorkflowEvent | null;
  decks: { name: string }[];
}

function scopeMatches(deckNames: string[], scope: { name: string }[]): boolean {
  if (scope.length === 0) {
    return true;
  }

  const wanted = new Set(scope.map((deck) => deck.name.toLowerCase()));
  return deckNames.some((name) => wanted.has(name.toLowerCase()));
}

export function matchesWorkflow(
  workflow: TriggerWorkflow,
  trigger: EventTrigger,
): boolean {
  if (!workflow.enabled || workflow.event !== trigger.kind) {
    return false;
  }

  const deckNames =
    trigger.kind === 'dumpCreated'
      ? trigger.dump.deckNames
      : [trigger.deck.name];

  return scopeMatches(deckNames, workflow.decks);
}
