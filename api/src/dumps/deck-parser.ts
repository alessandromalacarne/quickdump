// A deck marker is `@name`, but only where a word starts: `foo@bar.com` is
// an email, not a deck. `/m` so a marker opening a line counts too.
const DECK_MARKER = /(?:^|[ \t])@([\p{L}\p{N}_-]+)/gmu;

export function extractDecks(content: string): string[] {
  const names = [...content.matchAll(DECK_MARKER)].map((match) =>
    match[1].toLowerCase(),
  );
  return [...new Set(names)];
}

export function stripDecks(content: string): string {
  return content
    .replace(DECK_MARKER, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}
