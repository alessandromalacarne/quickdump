import { BadRequestException } from '@nestjs/common';
import {
  parseExportConfig,
  parseScriptConfig,
  validateTrigger,
} from './workflow-config.js';

describe('validating the config of a script action', () => {
  it('applies the defaults', () => {
    expect(parseScriptConfig({ script: 'notify.sh' })).toEqual({
      script: 'notify.sh',
      args: [],
      cwd: undefined,
      timeoutMs: 30_000,
    });
  });

  it('keeps the configured arguments and limits', () => {
    expect(
      parseScriptConfig({
        script: 'notify.sh',
        args: ['--quiet', 'casa'],
        cwd: '/home/me/notes',
        timeoutMs: 5_000,
      }),
    ).toEqual({
      script: 'notify.sh',
      args: ['--quiet', 'casa'],
      cwd: '/home/me/notes',
      timeoutMs: 5_000,
    });
  });

  it('rejects a script outside the scripts directory', () => {
    expect(() => parseScriptConfig({ script: '../../etc/passwd.sh' })).toThrow(
      BadRequestException,
    );
    expect(() => parseScriptConfig({ script: 'dir/notify.sh' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a script that is not a shell script', () => {
    expect(() => parseScriptConfig({ script: 'notify.exe' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing script name', () => {
    expect(() => parseScriptConfig({})).toThrow(BadRequestException);
    expect(() => parseScriptConfig({ script: '  ' })).toThrow(
      BadRequestException,
    );
  });
});

describe('rejecting a malformed script config', () => {
  it('rejects arguments that are not strings', () => {
    expect(() => parseScriptConfig({ script: 'a.sh', args: [1] })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a timeout outside the allowed range', () => {
    expect(() => parseScriptConfig({ script: 'a.sh', timeoutMs: 10 })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseScriptConfig({ script: 'a.sh', timeoutMs: 900_000 }),
    ).toThrow(BadRequestException);
  });

  it('rejects a config that is not an object', () => {
    expect(() => parseScriptConfig(null)).toThrow(BadRequestException);
    expect(() => parseScriptConfig('notify.sh')).toThrow(BadRequestException);
  });
});

describe('validating the config of an export action', () => {
  it('defaults to everything since the last run', () => {
    expect(parseExportConfig({})).toEqual({
      window: 'sinceLastRun',
      directory: undefined,
      filenameTemplate: undefined,
    });
  });

  it('accepts the known windows', () => {
    expect(parseExportConfig({ window: 'day' }).window).toBe('day');
    expect(parseExportConfig({ window: 'all' }).window).toBe('all');
  });

  it('rejects an unknown window', () => {
    expect(() => parseExportConfig({ window: 'hourly' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a file name template that could escape the directory', () => {
    expect(() =>
      parseExportConfig({ filenameTemplate: '../outside-{date}.txt' }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseExportConfig({ filenameTemplate: 'sub/dir-{date}.txt' }),
    ).toThrow(BadRequestException);
  });

  it('rejects an empty file name template', () => {
    expect(() => parseExportConfig({ filenameTemplate: '' })).toThrow(
      BadRequestException,
    );
  });
});

describe('validating the trigger of a workflow', () => {
  it('accepts an event without a cron', () => {
    expect(() =>
      validateTrigger({ event: 'dumpCreated', cron: null, timezone: 'UTC' }),
    ).not.toThrow();
  });

  it('accepts a cron without an event', () => {
    expect(() =>
      validateTrigger({
        event: null,
        cron: '59 23 * * *',
        timezone: 'America/Sao_Paulo',
      }),
    ).not.toThrow();
  });

  it('rejects a workflow without any trigger', () => {
    expect(() =>
      validateTrigger({ event: null, cron: null, timezone: 'UTC' }),
    ).toThrow(BadRequestException);
  });

  it('rejects a workflow with both triggers', () => {
    expect(() =>
      validateTrigger({
        event: 'dumpCreated',
        cron: '59 23 * * *',
        timezone: 'UTC',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects an invalid cron expression', () => {
    expect(() =>
      validateTrigger({ event: null, cron: 'todo dia', timezone: 'UTC' }),
    ).toThrow(BadRequestException);
  });

  it('rejects an unknown timezone', () => {
    expect(() =>
      validateTrigger({
        event: null,
        cron: '59 23 * * *',
        timezone: 'Mars/Olympus',
      }),
    ).toThrow(BadRequestException);
  });
});
