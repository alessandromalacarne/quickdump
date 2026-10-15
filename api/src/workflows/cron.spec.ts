import { isValidCron, nextRun } from './cron.js';

describe('validating a cron expression', () => {
  it('accepts the usual five field expressions', () => {
    expect(isValidCron('59 23 * * *')).toBe(true);
    expect(isValidCron('*/5 8-18 * * 1-5')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isValidCron('todo dia as 23:59')).toBe(false);
    expect(isValidCron('')).toBe(false);
    expect(isValidCron('99 99 * * *')).toBe(false);
  });
});

describe('computing the next run', () => {
  it('resolves the expression in the workflow timezone', () => {
    expect(
      nextRun(
        '59 23 * * *',
        'America/Sao_Paulo',
        new Date('2026-10-15T12:00:00.000Z'),
      ),
    ).toEqual(new Date('2026-10-16T02:59:00.000Z'));
  });

  it('never returns the instant it was asked from', () => {
    expect(
      nextRun(
        '59 23 * * *',
        'America/Sao_Paulo',
        new Date('2026-10-16T02:59:00.000Z'),
      ),
    ).toEqual(new Date('2026-10-17T02:59:00.000Z'));
  });

  it('handles a timezone ahead of UTC', () => {
    expect(
      nextRun('0 9 * * *', 'Asia/Tokyo', new Date('2026-10-15T12:00:00.000Z')),
    ).toEqual(new Date('2026-10-16T00:00:00.000Z'));
  });
});
