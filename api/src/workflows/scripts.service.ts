import { BadRequestException, Injectable } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SCRIPTS_DIR = fileURLToPath(
  new URL('../../../scripts/workflows', import.meta.url),
);
const SCRIPT_SUFFIX = '.sh';
const DESCRIPTION_BYTES = 4096;

export interface ScriptRef {
  name: string;
  description?: string;
}

@Injectable()
export class ScriptsService {
  directory(): string {
    return process.env.QUICKDUMP_SCRIPTS_DIR ?? DEFAULT_SCRIPTS_DIR;
  }

  async list(): Promise<ScriptRef[]> {
    const directory = this.directory();
    const entries = await readdir(directory, { withFileTypes: true }).catch(
      () => [],
    );
    const names = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(SCRIPT_SUFFIX))
      .map((entry) => entry.name)
      .sort();

    return Promise.all(
      names.map(async (name) => ({
        name,
        description: await this.describe(join(directory, name)),
      })),
    );
  }

  async resolve(name: string): Promise<string> {
    if (name !== basename(name)) {
      throw new BadRequestException(`Unknown script: ${name}`);
    }

    const listed = (await this.list()).some((script) => script.name === name);
    if (!listed) {
      throw new BadRequestException(`Unknown script: ${name}`);
    }

    return join(this.directory(), name);
  }

  private async describe(path: string): Promise<string | undefined> {
    const source = await readFile(path, 'utf8').catch(() => '');
    const comment = source
      .split('\n', DESCRIPTION_BYTES)
      .slice(1)
      .find((line) => line.trimStart().startsWith('#'));

    return comment?.trimStart().replace(/^#+\s*/, '') || undefined;
  }
}
