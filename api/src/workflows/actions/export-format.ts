import { dateIn, timeIn } from '../time.js';

export interface ExportDump {
  content: string;
  createdAt: Date;
  decks: { name: string }[];
}

export interface ExportWindow {
  from: Date;
  to: Date;
  timezone: string;
}

const DEFAULT_FILE_NAME = 'quickdump-{date}.txt';

function dumpHeader(dump: ExportDump, timezone: string): string {
  const stamp = `${dateIn(timezone, dump.createdAt)} ${timeIn(timezone, dump.createdAt)}`;
  const decks = [...dump.decks]
    .map((deck) => `@${deck.name}`)
    .sort()
    .join(' ');

  return decks ? `${stamp}  ${decks}` : stamp;
}

export function formatExport(
  dumps: ExportDump[],
  window: ExportWindow,
): string {
  const { timezone } = window;
  const lines = [
    `quickdump — ${dateIn(timezone, window.to)}`,
    `window: ${dateIn(timezone, window.from)} ${timeIn(timezone, window.from)}` +
      ` → ${dateIn(timezone, window.to)} ${timeIn(timezone, window.to)} (${timezone})`,
    '',
  ];

  for (const dump of dumps) {
    lines.push(dumpHeader(dump, timezone), dump.content, '');
  }

  return lines.join('\n');
}

export function exportFileName(
  template: string | undefined,
  window: ExportWindow,
): string {
  const resolved = template ?? DEFAULT_FILE_NAME;

  return resolved
    .replaceAll('{date}', dateIn(window.timezone, window.to))
    .replaceAll('{from}', dateIn(window.timezone, window.from))
    .replaceAll('{to}', dateIn(window.timezone, window.to));
}
