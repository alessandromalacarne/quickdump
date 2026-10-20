import type { Prisma } from '../generated/prisma/client.js';
import type { Deck, Workflow } from '../generated/prisma/client.js';

export type WorkflowWithDecks = Workflow & { decks: Deck[] };

// Prisma's write type demands an index signature that plain interfaces do not
// carry; everything stored here goes through JSON.stringify either way.
export function asJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
