import { extractDecks, stripDecks } from './deck-parser.js';

describe('extractDecks', () => {
  it('collects names lowercased and deduplicated', () => {
    expect(extractDecks('comprar café @casa @Casa @casa-trabalho')).toEqual([
      'casa',
      'casa-trabalho',
    ]);
  });

  it('accepts accents, digits, hyphens and underscores', () => {
    expect(extractDecks('anotar @café @42 @casa-grande @bem_vindo')).toEqual([
      'café',
      '42',
      'casa-grande',
      'bem_vindo',
    ]);
  });

  it('ignores a marker at the start of the dump', () => {
    expect(extractDecks('@casa varrer o chão')).toEqual([]);
  });

  it('ignores a marker in the middle of the dump', () => {
    expect(extractDecks('varrer @casa o chão')).toEqual([]);
  });

  it('finds markers on the last line', () => {
    expect(extractDecks('linha um\nlinha dois @casa')).toEqual(['casa']);
    expect(extractDecks('linha um\n@casa')).toEqual(['casa']);
  });

  it('ignores a marker followed by punctuation', () => {
    expect(extractDecks('list @casa, then @trabalho.')).toEqual([]);
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

  it('removes every trailing marker', () => {
    expect(stripDecks('comprar café @casa @trabalho')).toBe('comprar café');
    expect(stripDecks('comprar café\n@casa\n@trabalho')).toBe('comprar café');
  });

  it('keeps a leading marker as part of the body', () => {
    expect(stripDecks('@casa comprar café')).toBe('@casa comprar café');
  });

  it('keeps markers in the middle as part of the body', () => {
    expect(stripDecks('café @casa com @trabalho agora')).toBe(
      'café @casa com @trabalho agora',
    );
  });

  it('keeps a marker followed by punctuation as part of the body', () => {
    expect(stripDecks('list @casa, then @trabalho.')).toBe(
      'list @casa, then @trabalho.',
    );
  });

  it('keeps the line structure of a multiline body', () => {
    expect(stripDecks('linha um\nlinha dois\nlinha três @trabalho')).toBe(
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
    expect(stripDecks('primeira linha\n  segunda linha @casa')).toBe(
      'primeira linha\n  segunda linha',
    );
  });

  it('drops the spaces left around the trailing markers', () => {
    expect(stripDecks('café @casa  ')).toBe('café');
    expect(stripDecks('café  \nsegunda @casa')).toBe('café\nsegunda');
  });

  it('leaves an @ glued to a word alone', () => {
    expect(stripDecks('mail me at foo@bar.com @casa')).toBe(
      'mail me at foo@bar.com',
    );
  });
});
