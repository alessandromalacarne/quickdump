import { extractTags } from './tag-parser.js';

describe('extractTags', () => {
  it('deduplicates repeated tags', () => {
    expect(extractTags('#casa #Casa #casa-trabalho')).toEqual([
      'casa',
      'casa-trabalho',
    ]);
  });

  it('a lone # is not a tag', () => {
    expect(extractTags('# and some loose text')).toEqual([]);
  });

  it('does not include punctuation at the end of a tag', () => {
    expect(extractTags('list #casa, then #trabalho.')).toEqual([
      'casa',
      'trabalho',
    ]);
  });

  it('accepts accents, numbers, hyphens and underscores', () => {
    expect(extractTags('#café #42 #casa-grande #bem_vindo')).toEqual([
      'café',
      '42',
      'casa-grande',
      'bem_vindo',
    ]);
  });

  it('returns empty when there are no tags', () => {
    expect(extractTags('plain text without any tag')).toEqual([]);
  });
});
