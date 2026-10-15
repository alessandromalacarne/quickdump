import { dateIn, isValidTimezone, startOfDay, timeIn } from './time.js';

describe('rendering instants in a timezone', () => {
  it('formats the date and the time in the given timezone', () => {
    const instant = new Date('2026-10-15T17:32:00.000Z');

    expect(dateIn('America/Sao_Paulo', instant)).toBe('2026-10-15');
    expect(timeIn('America/Sao_Paulo', instant)).toBe('14:32');
    expect(dateIn('UTC', instant)).toBe('2026-10-15');
    expect(timeIn('UTC', instant)).toBe('17:32');
  });

  it('knows which timezones exist', () => {
    expect(isValidTimezone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Nope/Nope')).toBe(false);
  });
});

describe('finding the start of the local day', () => {
  it('returns local midnight, not UTC midnight', () => {
    expect(
      startOfDay(new Date('2026-10-15T17:32:00.000Z'), 'America/Sao_Paulo'),
    ).toEqual(new Date('2026-10-15T03:00:00.000Z'));
  });

  it('handles instants that are still on the previous local day', () => {
    expect(
      startOfDay(new Date('2026-10-15T02:00:00.000Z'), 'America/Sao_Paulo'),
    ).toEqual(new Date('2026-10-14T03:00:00.000Z'));
  });

  it('handles timezones ahead of UTC', () => {
    expect(
      startOfDay(new Date('2026-10-15T12:00:00.000Z'), 'Asia/Tokyo'),
    ).toEqual(new Date('2026-10-14T15:00:00.000Z'));
  });
});
