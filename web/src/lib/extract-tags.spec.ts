import { describe, expect, it } from 'vitest';
import { extractTags } from './extract-tags';

describe('extractTags', () => {
  it('extracts normalized, deduplicated tags', () => {
    expect(extractTags('#Casa comprar café #casa #casa-trabalho')).toEqual([
      'casa',
      'casa-trabalho',
    ]);
  });

  it('ignores a lone # and surrounding punctuation', () => {
    expect(extractTags('# #trabalho.')).toEqual(['trabalho']);
  });

  it('accepts accents, numbers, hyphens and underscores', () => {
    expect(extractTags('#café #42 #bem_vindo')).toEqual([
      'café',
      '42',
      'bem_vindo',
    ]);
  });
});
