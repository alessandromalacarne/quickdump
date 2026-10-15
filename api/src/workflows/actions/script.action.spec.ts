import { fileURLToPath } from 'node:url';
import { runScriptAction } from './script.action.js';

const fixtures = fileURLToPath(
  new URL('../../../test/fixtures/scripts', import.meta.url),
);

const scriptPath = (name: string) => `${fixtures}/${name}`;

describe('running a script', () => {
  it('captures the output of a successful script', async () => {
    const result = await runScriptAction({
      scriptPath: scriptPath('hello.sh'),
      args: [],
      timeoutMs: 5_000,
      env: {},
      payload: {},
    });

    expect(result).toEqual({
      stdout: 'hello from hello.sh\n',
      stderr: '',
      exitCode: 0,
      error: undefined,
    });
  });

  it('hands the payload over on stdin and the trigger through the environment', async () => {
    const result = await runScriptAction({
      scriptPath: scriptPath('payload.sh'),
      args: ['--flag', 'casa'],
      timeoutMs: 5_000,
      env: { QUICKDUMP_EVENT: 'dumpCreated', QUICKDUMP_DUMP_ID: 'dump-1' },
      payload: { kind: 'dumpCreated' },
    });

    expect(result.stdout).toContain('{"kind":"dumpCreated"}');
    expect(result.stdout).toContain('event=dumpCreated');
    expect(result.stdout).toContain('dump=dump-1');
    expect(result.stdout).toContain('args=--flag casa');
  });

  it('reports the exit code of a failing script without throwing', async () => {
    const result = await runScriptAction({
      scriptPath: scriptPath('fail.sh'),
      args: [],
      timeoutMs: 5_000,
      env: {},
      payload: {},
    });

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBe('about to fail\n');
    expect(result.error).toBeUndefined();
  });
});

describe('when a script misbehaves', () => {
  it('kills a script that runs past its timeout', async () => {
    const result = await runScriptAction({
      scriptPath: scriptPath('slow.sh'),
      args: [],
      timeoutMs: 150,
      env: {},
      payload: {},
    });

    expect(result.stdout).toBe('');
    expect(result.error).toBe('Script timed out after 150ms');
  });

  it('caps the captured output', async () => {
    const result = await runScriptAction({
      scriptPath: scriptPath('flood.sh'),
      args: [],
      timeoutMs: 10_000,
      env: {},
      payload: {},
    });

    expect(result.stdout).toContain('[output truncated]');
    expect(result.stderr).toContain('[output truncated]');
    expect(result.stdout.length).toBeLessThan(70_000);
  });

  it('reports a script that cannot be started', async () => {
    const result = await runScriptAction({
      scriptPath: scriptPath('hello.sh'),
      args: [],
      cwd: `${fixtures}/does-not-exist`,
      timeoutMs: 5_000,
      env: {},
      payload: {},
    });

    expect(result.exitCode).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
