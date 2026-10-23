import { describe, expect, it } from 'vitest';
import { extractDecks, stripDecks } from './extract-decks';

describe('extractDecks', () => {
  it('extracts normalized, deduplicated decks', () => {
    expect(extractDecks('comprar café @Casa @casa @casa-trabalho')).toEqual([
      'casa',
      'casa-trabalho',
    ]);
  });

  it('ignores a lone @ and an @ glued to a word', () => {
    expect(extractDecks('@ mail me at foo@bar.com')).toEqual([]);
  });

  it('accepts accents, numbers, hyphens and underscores', () => {
    expect(extractDecks('anotar @café @42 @bem_vindo')).toEqual([
      'café',
      '42',
      'bem_vindo',
    ]);
  });

  it('no longer treats # as a marker', () => {
    expect(extractDecks('#casa plain text')).toEqual([]);
  });

  it('ignores a marker at the start of the dump', () => {
    expect(extractDecks('@casa varrer o chão')).toEqual([]);
  });

  it('ignores a marker in the middle of the dump', () => {
    expect(extractDecks('varrer @casa o chão')).toEqual([]);
  });

  it('ignores a marker followed by punctuation', () => {
    expect(extractDecks('list @casa, then @trabalho.')).toEqual([]);
  });

  it('finds markers on the last line', () => {
    expect(extractDecks('linha um\nlinha dois @casa')).toEqual(['casa']);
  });
});

describe('stripDecks', () => {
  it('removes the trailing markers and the space that carried them', () => {
    expect(stripDecks('comprar café @casa')).toBe('comprar café');
    expect(stripDecks('comprar café @casa @trabalho')).toBe('comprar café');
  });

  it('keeps a leading marker as part of the body', () => {
    expect(stripDecks('@casa comprar café')).toBe('@casa comprar café');
  });

  it('keeps markers in the middle as part of the body', () => {
    expect(stripDecks('café @casa com @trabalho agora')).toBe(
      'café @casa com @trabalho agora',
    );
  });

  it('collapses to an empty string when only markers were written', () => {
    expect(stripDecks(' @casa @trabalho ')).toBe('');
  });

  it('keeps the indentation of a multiline body', () => {
    expect(stripDecks('primeira linha\n  segunda linha @casa')).toBe(
      'primeira linha\n  segunda linha',
    );
  });

  it('drops the spaces left around the trailing markers', () => {
    expect(stripDecks('café @casa  ')).toBe('café');
    expect(stripDecks('café  \nsegunda @casa')).toBe('café\nsegunda');
  });
});
