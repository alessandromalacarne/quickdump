// A deck marker is `@name`, and only at the end of the dump: `@casa buy
// coffee` is plain text, while `buy coffee @casa` names a deck. `/u` keeps
// accented names together and `\s` lets a marker sit on its own last line.
const TRAILING_MARKERS =
  /(?:^|\s)((?:@[\p{L}\p{N}_-]+(?:\s+@[\p{L}\p{N}_-]+)*))$/u;
const MARKER_NAME = /@([\p{L}\p{N}_-]+)/gu;

function splitDecks(content: string): { body: string; deckNames: string[] } {
  const trimmed = content.trimEnd();
  const match = TRAILING_MARKERS.exec(trimmed);

  if (match === null) {
    return { body: trimmed, deckNames: [] };
  }

  const names = [...match[1].matchAll(MARKER_NAME)].map((name) =>
    name[1].toLowerCase(),
  );

  return {
    body: trimmed.slice(0, match.index).trimEnd(),
    deckNames: [...new Set(names)],
  };
}

export function extractDecks(content: string): string[] {
  return splitDecks(content).deckNames;
}

export function stripDecks(content: string): string {
  return splitDecks(content)
    .body.split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}
