import { describe, expect, it } from 'vitest';
import { extractDecks, stripDecks } from './extract-decks';

describe('extractDecks', () => {
  it('extracts normalized, deduplicated decks', () => {
    expect(extractDecks('@Casa comprar café @casa @casa-trabalho')).toEqual([
      'casa',
      'casa-trabalho',
    ]);
  });

  it('ignores a lone @ and an @ glued to a word', () => {
    expect(extractDecks('@ mail me at foo@bar.com')).toEqual([]);
  });

  it('accepts accents, numbers, hyphens and underscores', () => {
    expect(extractDecks('@café @42 @bem_vindo')).toEqual([
      'café',
      '42',
      'bem_vindo',
    ]);
  });

  it('no longer treats # as a marker', () => {
    expect(extractDecks('#casa plain text')).toEqual([]);
  });
});

describe('stripDecks', () => {
  it('removes the marker and the space that carried it', () => {
    expect(stripDecks('comprar café @casa')).toBe('comprar café');
    expect(stripDecks('@casa comprar café')).toBe('comprar café');
    expect(stripDecks('café @casa com @trabalho agora')).toBe('café com agora');
  });

  it('collapses to an empty string when only markers were written', () => {
    expect(stripDecks(' @casa @trabalho ')).toBe('');
  });

  it('keeps the indentation of a multiline body', () => {
    expect(stripDecks('primeira linha @casa\n  segunda linha')).toBe(
      'primeira linha\n  segunda linha',
    );
  });

  it('drops the spaces a marker left at the end of a line', () => {
    expect(stripDecks('café @casa  \nsegunda')).toBe('café\nsegunda');
  });
});
