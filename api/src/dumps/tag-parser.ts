export function extractTags(content: string): string[] {
  const names = [...content.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) =>
    match[1].toLowerCase(),
  );
  return [...new Set(names)];
}
