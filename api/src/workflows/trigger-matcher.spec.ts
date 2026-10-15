import type { EventTrigger } from './trigger.js';
import { matchesWorkflow } from './trigger-matcher.js';

const dumpCreated = (tagNames: string[]): EventTrigger => ({
  kind: 'dumpCreated',
  occurredAt: '2026-10-15T12:00:00.000Z',
  dump: { id: 'dump-1', content: '#casa buy coffee', tagNames },
});

const tagDeleted = (name: string): EventTrigger => ({
  kind: 'tagDeleted',
  occurredAt: '2026-10-15T12:00:00.000Z',
  tag: { id: 'tag-1', name },
});

describe('matching a dump against a tag scoped workflow', () => {
  it('matches when the dump carries one of the workflow tags', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'dumpCreated', tags: [{ name: 'casa' }] },
        dumpCreated(['casa', 'financas']),
      ),
    ).toBe(true);
  });

  it('does not match when the dump carries none of the workflow tags', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'dumpCreated', tags: [{ name: 'casa' }] },
        dumpCreated(['trabalho']),
      ),
    ).toBe(false);
  });

  it('compares tag names ignoring case', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'dumpCreated', tags: [{ name: 'casa' }] },
        dumpCreated(['Casa']),
      ),
    ).toBe(true);
  });

  it('matches any dump when the workflow has no tag scope', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'dumpCreated', tags: [] },
        dumpCreated(['trabalho']),
      ),
    ).toBe(true);
  });

  it('does not match when the workflow is disabled', () => {
    expect(
      matchesWorkflow(
        { enabled: false, event: 'dumpCreated', tags: [] },
        dumpCreated(['casa']),
      ),
    ).toBe(false);
  });

  it('does not match a workflow waiting for another event', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'tagDeleted', tags: [] },
        dumpCreated(['casa']),
      ),
    ).toBe(false);
  });

  it('does not match a scheduled workflow', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: null, tags: [] },
        dumpCreated(['casa']),
      ),
    ).toBe(false);
  });
});

describe('matching a deleted tag against a tag scoped workflow', () => {
  it('matches when the deleted tag is the workflow scope', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'tagDeleted', tags: [{ name: 'casa' }] },
        tagDeleted('casa'),
      ),
    ).toBe(true);
  });

  it('does not match when the deleted tag is outside the scope', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'tagDeleted', tags: [{ name: 'casa' }] },
        tagDeleted('trabalho'),
      ),
    ).toBe(false);
  });

  it('matches any deleted tag when the workflow has no tag scope', () => {
    expect(
      matchesWorkflow(
        { enabled: true, event: 'tagDeleted', tags: [] },
        tagDeleted('trabalho'),
      ),
    ).toBe(true);
  });
});
