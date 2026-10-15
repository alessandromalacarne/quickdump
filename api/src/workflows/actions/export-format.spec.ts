import { exportFileName, formatExport } from './export-format.js';

const window = {
  from: new Date('2026-10-15T03:00:00.000Z'),
  to: new Date('2026-10-16T02:59:00.000Z'),
  timezone: 'America/Sao_Paulo',
};

describe('formatting an export file', () => {
  it('opens with the window it covers', () => {
    expect(formatExport([], window)).toBe(
      [
        'quickdump — 2026-10-15',
        'window: 2026-10-15 00:00 → 2026-10-15 23:59 (America/Sao_Paulo)',
        '',
      ].join('\n'),
    );
  });

  it('renders each dump with its local time and tags', () => {
    const text = formatExport(
      [
        {
          content: 'pagar aluguel',
          createdAt: new Date('2026-10-15T17:32:00.000Z'),
          tags: [{ name: 'financas' }, { name: 'casa' }],
        },
      ],
      window,
    );

    expect(text).toContain('2026-10-15 14:32  #casa #financas\npagar aluguel');
  });

  it('separates dumps with a blank line and keeps multi-line content', () => {
    const text = formatExport(
      [
        {
          content: 'ideia pro post',
          createdAt: new Date('2026-10-15T12:11:00.000Z'),
          tags: [{ name: 'blog' }],
        },
        {
          content: 'linha 1\nlinha 2',
          createdAt: new Date('2026-10-15T19:00:00.000Z'),
          tags: [{ name: 'casa' }],
        },
      ],
      window,
    );

    expect(text.split('\n\n')).toEqual([
      'quickdump — 2026-10-15\nwindow: 2026-10-15 00:00 → 2026-10-15 23:59 (America/Sao_Paulo)',
      '2026-10-15 09:11  #blog\nideia pro post',
      '2026-10-15 16:00  #casa\nlinha 1\nlinha 2\n',
    ]);
  });
});

describe('naming an export file', () => {
  it('expands the date placeholders in the configured timezone', () => {
    expect(exportFileName('{from}-{to}-{date}.txt', window)).toBe(
      '2026-10-15-2026-10-15-2026-10-15.txt',
    );
  });

  it('defaults to a daily file name', () => {
    expect(exportFileName(undefined, window)).toBe('quickdump-2026-10-15.txt');
  });
});
