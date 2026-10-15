import { spawn, type ChildProcess } from 'node:child_process';

const MAX_OUTPUT_BYTES = 64 * 1024;
const TRUNCATION_MARKER = '\n[output truncated]\n';

// Killing the shell alone would leave its children holding the pipes open, so
// the script runs in its own process group and the whole group is killed.
function killGroup(child: ChildProcess): void {
  if (child.pid === undefined) {
    child.kill('SIGKILL');
    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

export interface ScriptActionInput {
  scriptPath: string;
  args: string[];
  cwd?: string;
  timeoutMs: number;
  env: Record<string, string>;
  payload: unknown;
}

export interface ScriptActionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
}

class OutputCollector {
  private readonly chunks: Buffer[] = [];
  private size = 0;
  private truncated = false;

  push(chunk: Buffer): void {
    const room = MAX_OUTPUT_BYTES - this.size;

    if (room <= 0) {
      this.truncated = true;
      return;
    }

    if (chunk.length > room) {
      this.chunks.push(chunk.subarray(0, room));
      this.size = MAX_OUTPUT_BYTES;
      this.truncated = true;
      return;
    }

    this.chunks.push(chunk);
    this.size += chunk.length;
  }

  text(): string {
    const output = Buffer.concat(this.chunks).toString('utf8');
    return this.truncated ? `${output}${TRUNCATION_MARKER}` : output;
  }
}

export function runScriptAction(
  input: ScriptActionInput,
): Promise<ScriptActionResult> {
  return new Promise((resolve) => {
    const child = spawn('sh', [input.scriptPath, ...input.args], {
      cwd: input.cwd,
      env: { ...process.env, ...input.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });
    const stdout = new OutputCollector();
    const stderr = new OutputCollector();
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child);
    }, input.timeoutMs);

    const finish = (result: ScriptActionResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    child.on('error', (error: Error) => {
      finish({
        stdout: stdout.text(),
        stderr: stderr.text(),
        exitCode: null,
        error: error.message,
      });
    });

    child.on('close', (exitCode: number | null) => {
      finish({
        stdout: stdout.text(),
        stderr: stderr.text(),
        exitCode,
        error: timedOut
          ? `Script timed out after ${input.timeoutMs}ms`
          : undefined,
      });
    });

    // A script that never reads stdin closes the pipe on us.
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(input.payload));
  });
}
