import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { startOfDay } from '../time.js';
import type { WorkflowWindow } from '../trigger.js';
import type { ExportConfig, ExportWindowKind } from '../workflow-config.js';
import {
  exportFileName,
  formatExport,
  type ExportDump,
} from './export-format.js';

const EPOCH = new Date(0);
const DEFAULT_DIRECTORY = join(homedir(), '.quickdump', 'exports');

export interface ResolvedWindow {
  from: Date;
  to: Date;
}

export interface ExportActionResult {
  outputFile?: string;
  stdout: string;
}

export function resolveExportWindow(input: {
  window: ExportWindowKind;
  timezone: string;
  now: Date;
  lastRunAt: Date | null;
  triggerWindow?: WorkflowWindow;
}): ResolvedWindow {
  const to = input.triggerWindow ? new Date(input.triggerWindow.to) : input.now;

  if (input.window === 'all') {
    return { from: EPOCH, to };
  }

  if (input.window === 'day') {
    return { from: startOfDay(to, input.timezone), to };
  }

  if (input.triggerWindow) {
    return { from: new Date(input.triggerWindow.from), to };
  }

  return { from: input.lastRunAt ?? startOfDay(to, input.timezone), to };
}

export async function runExportAction(input: {
  dumps: ExportDump[];
  config: ExportConfig;
  window: ResolvedWindow;
  timezone: string;
}): Promise<ExportActionResult> {
  if (input.dumps.length === 0) {
    return { stdout: 'no dumps in the window' };
  }

  const directory =
    input.config.directory ??
    process.env.QUICKDUMP_EXPORT_DIR ??
    DEFAULT_DIRECTORY;
  const window = { ...input.window, timezone: input.timezone };
  const outputFile = join(
    directory,
    exportFileName(input.config.filenameTemplate, window),
  );

  await mkdir(directory, { recursive: true });
  await writeFile(outputFile, formatExport(input.dumps, window), 'utf8');

  return {
    outputFile,
    stdout: `wrote ${input.dumps.length} dumps to ${outputFile}`,
  };
}
