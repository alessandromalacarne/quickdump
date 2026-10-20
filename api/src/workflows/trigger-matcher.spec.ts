import type { EventTrigger } from './trigger.js';
import { matchesWorkflow } from './trigger-matcher.js';

const dumpCreated = (deckNames: string[]): EventTrigger => ({
  kind: 'dumpCreated',
  occurredAt: '2026-10-15T12:00:00.000Z',
  dump: { id: 'dump-1', content: 'buy coffee', deckNames },
});

const deckDeleted = (name: string): EventTrigger => ({
  kind: 'deckDeleted',
  occurredAt: '2026-10-15T12:00:00.000Z',
  deck: { id: 'deck-1', name },
});

describe('matching a dump against a deck scoped workflow', () => {
  it('matches when the dump carries one of the workflow decks', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'dumpCreated', decks: [{ name: 'casa' }] },
        dumpCreated(['casa', 'financas']),
      ),
    ).toBe(true);
  });

  it('does not match when the dump carries none of the workflow decks', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'dumpCreated', decks: [{ name: 'casa' }] },
        dumpCreated(['trabalho']),
      ),
    ).toBe(false);
  });

  it('compares deck names ignoring case', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'dumpCreated', decks: [{ name: 'casa' }] },
        dumpCreated(['Casa']),
      ),
    ).toBe(true);
  });

  it('matches any dump when the workflow has no deck scope', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'dumpCreated', decks: [] },
        dumpCreated(['trabalho']),
      ),
    ).toBe(true);
  });

  it('does not match when the workflow is disabled', () => {
    expect(
      matchesWorkflow(
        { enabled: false, event: 'dumpCreated', decks: [] },
        dumpCreated(['casa']),
      ),
    ).toBe(false);
  });

  it('does not match a workflow waiting for another event', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'deckDeleted', decks: [] },
        dumpCreated(['casa']),
      ),
    ).toBe(false);
  });

  it('does not match a scheduled workflow', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: null, decks: [] },
        dumpCreated(['casa']),
      ),
    ).toBe(false);
  });
});

describe('matching a deleted deck against a deck scoped workflow', () => {
  it('matches when the deleted deck is the workflow scope', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'deckDeleted', decks: [{ name: 'casa' }] },
        deckDeleted('casa'),
      ),
    ).toBe(true);
  });

  it('does not match when the deleted deck is outside the scope', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'deckDeleted', decks: [{ name: 'casa' }] },
        deckDeleted('trabalho'),
      ),
    ).toBe(false);
  });

  it('matches any deleted deck when the workflow has no deck scope', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'deckDeleted', decks: [] },
        deckDeleted('trabalho'),
      ),
    ).toBe(true);
  });
});
