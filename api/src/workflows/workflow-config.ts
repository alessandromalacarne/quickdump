import { BadRequestException } from '@nestjs/common';
import type {
  WorkflowAction,
  WorkflowEvent,
} from '../generated/prisma/enums.js';
import { isValidCron } from './cron.js';
import { isValidTimezone } from './time.js';

const SCRIPT_NAME = /^[A-Za-z0-9._-]+\.sh$/;
const DEFAULT_SCRIPT_TIMEOUT_MS = 30_000;
const MIN_SCRIPT_TIMEOUT_MS = 1_000;
const MAX_SCRIPT_TIMEOUT_MS = 300_000;
const EXPORT_WINDOWS = ['sinceLastRun', 'day', 'all'] as const;

export type ExportWindowKind = (typeof EXPORT_WINDOWS)[number];

export interface ScriptConfig {
  script: string;
  args: string[];
  cwd?: string;
  timeoutMs: number;
}

export interface ExportConfig {
  window: ExportWindowKind;
  directory?: string;
  filenameTemplate?: string;
}

function asRecord(config: unknown): Record<string, unknown> {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new BadRequestException('config must be an object');
  }

  return config as Record<string, unknown>;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${field} must be a non-empty string`);
  }

  return value;
}

export function parseScriptConfig(config: unknown): ScriptConfig {
  const raw = asRecord(config);
  const script = raw.script;

  if (typeof script !== 'string' || !SCRIPT_NAME.test(script)) {
    throw new BadRequestException(
      'config.script must name a .sh file inside the scripts directory',
    );
  }

  const args = raw.args ?? [];
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new BadRequestException('config.args must be a list of strings');
  }

  const timeoutMs = raw.timeoutMs ?? DEFAULT_SCRIPT_TIMEOUT_MS;
  if (
    typeof timeoutMs !== 'number' ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < MIN_SCRIPT_TIMEOUT_MS ||
    timeoutMs > MAX_SCRIPT_TIMEOUT_MS
  ) {
    throw new BadRequestException(
      `config.timeoutMs must be an integer between ${MIN_SCRIPT_TIMEOUT_MS} and ${MAX_SCRIPT_TIMEOUT_MS}`,
    );
  }

  return {
    script,
    args: args as string[],
    cwd: optionalString(raw.cwd, 'config.cwd'),
    timeoutMs,
  };
}

export function parseExportConfig(config: unknown): ExportConfig {
  const raw = asRecord(config);
  const window = raw.window ?? 'sinceLastRun';

  if (!EXPORT_WINDOWS.includes(window as ExportWindowKind)) {
    throw new BadRequestException(
      `config.window must be one of ${EXPORT_WINDOWS.join(', ')}`,
    );
  }

  const filenameTemplate = optionalString(
    raw.filenameTemplate,
    'config.filenameTemplate',
  );
  if (filenameTemplate !== undefined && /[/\\]|\.\./.test(filenameTemplate)) {
    throw new BadRequestException(
      'config.filenameTemplate must be a plain file name',
    );
  }

  return {
    window: window as ExportWindowKind,
    directory: optionalString(raw.directory, 'config.directory'),
    filenameTemplate,
  };
}

export function parseActionConfig(
  action: WorkflowAction,
  config: unknown,
): ScriptConfig | ExportConfig {
  return action === 'script'
    ? parseScriptConfig(config)
    : parseExportConfig(config);
}

export function validateTrigger(input: {
  event: WorkflowEvent | null;
  cron: string | null;
  timezone: string;
}): void {
  const { event, cron, timezone } = input;

  if ((event === null) === (cron === null)) {
    throw new BadRequestException(
      'Set either an event or a cron expression, but not both',
    );
  }

  if (cron !== null && !isValidCron(cron)) {
    throw new BadRequestException('cron must be a valid cron expression');
  }

  if (!isValidTimezone(timezone)) {
    throw new BadRequestException('timezone must be a valid IANA timezone');
  }
}
