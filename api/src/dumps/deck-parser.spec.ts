import { extractDecks, stripDecks } from './deck-parser.js';

describe('extractDecks', () => {
  it('collects names lowercased and deduplicated', () => {
    expect(extractDecks('comprar café @casa @Casa @casa-trabalho')).toEqual([
      'casa',
      'casa-trabalho',
    ]);
  });

  it('accepts accents, digits, hyphens and underscores', () => {
    expect(extractDecks('@café @42 @casa-grande @bem_vindo')).toEqual([
      'café',
      '42',
      'casa-grande',
      'bem_vindo',
    ]);
  });

  it('finds a marker at the start of a line', () => {
    expect(extractDecks('linha um\n@casa linha dois')).toEqual(['casa']);
  });

  it('finds markers next to punctuation', () => {
    expect(extractDecks('list @casa, then @trabalho.')).toEqual([
      'casa',
      'trabalho',
    ]);
  });

  it('ignores an @ glued to a word', () => {
    expect(extractDecks('mail me at foo@bar.com')).toEqual([]);
  });

  it('ignores a lone @', () => {
    expect(extractDecks('@ and some loose text')).toEqual([]);
  });

  it('no longer treats # as a marker', () => {
    expect(extractDecks('porta #casa plain text')).toEqual([]);
  });

  it('returns an empty list for text without a marker', () => {
    expect(extractDecks('plain text without any deck')).toEqual([]);
  });
});

describe('stripDecks', () => {
  it('removes a trailing marker and the space that carried it', () => {
    expect(stripDecks('comprar café @casa')).toBe('comprar café');
  });

  it('removes a leading marker', () => {
    expect(stripDecks('@casa comprar café')).toBe('comprar café');
  });

  it('removes markers in the middle, keeping one space between words', () => {
    expect(stripDecks('café @casa com @trabalho agora')).toBe('café com agora');
  });

  it('leaves the comma attached to the word before the marker', () => {
    expect(stripDecks('list @casa, then @trabalho.')).toBe('list, then.');
  });

  it('keeps the line structure of a multiline body', () => {
    expect(stripDecks('linha um @casa\nlinha dois\nlinha três @trabalho')).toBe(
      'linha um\nlinha dois\nlinha três',
    );
  });

  it('collapses to an empty string when only markers were written', () => {
    expect(stripDecks(' @casa @trabalho ')).toBe('');
  });

  it('leaves #hashtags alone', () => {
    expect(stripDecks('porta #casa @casa')).toBe('porta #casa');
  });

  it('keeps the indentation of a multiline body', () => {
    expect(stripDecks('primeira linha @casa\n  segunda linha')).toBe(
      'primeira linha\n  segunda linha',
    );
  });

  it('drops the spaces a marker left at the end of a line', () => {
    expect(stripDecks('café @casa  \nsegunda')).toBe('café\nsegunda');
  });

  it('leaves an @ glued to a word alone', () => {
    expect(stripDecks('mail me at foo@bar.com @casa')).toBe(
      'mail me at foo@bar.com',
    );
  });
});
