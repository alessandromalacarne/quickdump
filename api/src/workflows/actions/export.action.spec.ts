import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveExportWindow, runExportAction } from './export.action.js';

const timezone = 'America/Sao_Paulo';
const now = new Date('2026-10-15T23:59:00.000Z');

// File-level setup: every export test writes into a directory of its own.
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'quickdump-export-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('resolving the window of an export', () => {
  it('uses the window of the scheduled run', () => {
    expect(
      resolveExportWindow({
        window: 'sinceLastRun',
        timezone,
        now,
        lastRunAt: null,
        triggerWindow: {
          from: '2026-10-15T02:59:00.000Z',
          to: '2026-10-15T23:59:00.000Z',
        },
      }),
    ).toEqual({
      from: new Date('2026-10-15T02:59:00.000Z'),
      to: new Date('2026-10-15T23:59:00.000Z'),
    });
  });

  it('falls back to the last run when a manual run has no window', () => {
    expect(
      resolveExportWindow({
        window: 'sinceLastRun',
        timezone,
        now,
        lastRunAt: new Date('2026-10-15T02:59:00.000Z'),
      }),
    ).toEqual({
      from: new Date('2026-10-15T02:59:00.000Z'),
      to: now,
    });
  });

  it('covers the local day', () => {
    expect(
      resolveExportWindow({ window: 'day', timezone, now, lastRunAt: null }),
    ).toEqual({
      from: new Date('2026-10-15T03:00:00.000Z'),
      to: now,
    });
  });

  it('covers everything for the all window', () => {
    expect(
      resolveExportWindow({ window: 'all', timezone, now, lastRunAt: null }),
    ).toEqual({ from: new Date(0), to: now });
  });
});

describe('writing an export file', () => {
  it('writes the dumps of the window to a text file', async () => {
    const result = await runExportAction({
      dumps: [
        {
          content: 'pagar aluguel',
          createdAt: new Date('2026-10-15T17:32:00.000Z'),
          tags: [{ name: 'casa' }],
        },
      ],
      config: { window: 'sinceLastRun', directory },
      window: {
        from: new Date('2026-10-15T03:00:00.000Z'),
        to: new Date('2026-10-16T02:59:00.000Z'),
      },
      timezone,
    });

    expect(result.outputFile).toBe(join(directory, 'quickdump-2026-10-15.txt'));
    expect(await readFile(result.outputFile!, 'utf8')).toContain(
      '2026-10-15 14:32  #casa\npagar aluguel',
    );
  });

  it('creates the destination directory when it is missing', async () => {
    const nested = join(directory, 'deep', 'exports');

    const result = await runExportAction({
      dumps: [
        {
          content: '#casa x',
          createdAt: new Date('2026-10-15T17:32:00.000Z'),
          tags: [{ name: 'casa' }],
        },
      ],
      config: { window: 'sinceLastRun', directory: nested },
      window: {
        from: new Date('2026-10-15T03:00:00.000Z'),
        to: new Date('2026-10-16T02:59:00.000Z'),
      },
      timezone,
    });

    expect(result.outputFile).toBe(join(nested, 'quickdump-2026-10-15.txt'));
  });
});

describe('choosing the file of an export', () => {
  it('writes nothing when the window has no dumps', async () => {
    const result = await runExportAction({
      dumps: [],
      config: { window: 'sinceLastRun', directory },
      window: {
        from: new Date('2026-10-15T03:00:00.000Z'),
        to: new Date('2026-10-16T02:59:00.000Z'),
      },
      timezone,
    });

    expect(result.outputFile).toBeUndefined();
    expect(result.stdout).toBe('no dumps in the window');
  });

  it('uses the configured file name template', async () => {
    const result = await runExportAction({
      dumps: [
        {
          content: '#casa x',
          createdAt: new Date('2026-10-15T17:32:00.000Z'),
          tags: [{ name: 'casa' }],
        },
      ],
      config: {
        window: 'sinceLastRun',
        directory,
        filenameTemplate: 'casa-{date}.txt',
      },
      window: {
        from: new Date('2026-10-15T03:00:00.000Z'),
        to: new Date('2026-10-16T02:59:00.000Z'),
      },
      timezone,
    });

    expect(result.outputFile).toBe(join(directory, 'casa-2026-10-15.txt'));
  });
});
