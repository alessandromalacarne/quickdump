import { BadRequestException } from '@nestjs/common';
import { fileURLToPath } from 'node:url';
import { ScriptsService } from './scripts.service.js';

const fixtures = fileURLToPath(
  new URL('../../test/fixtures/scripts', import.meta.url),
);

let service: ScriptsService;

beforeEach(() => {
  process.env.QUICKDUMP_SCRIPTS_DIR = fixtures;
  service = new ScriptsService();
});

afterEach(() => {
  delete process.env.QUICKDUMP_SCRIPTS_DIR;
});

describe('listing the available scripts', () => {
  it('lists the shell scripts with the description of their first comment', async () => {
    expect(await service.list()).toEqual([
      {
        name: 'fail.sh',
        description: 'Always fails, to exercise the failure path.',
      },
      {
        name: 'flood.sh',
        description: 'Writes far more than the output limit.',
      },
      {
        name: 'hello.sh',
        description: 'Prints the dump that triggered the workflow.',
      },
      {
        name: 'payload.sh',
        description:
          'Prints the payload received on stdin and the event from the environment.',
      },
      { name: 'plain.sh', description: undefined },
      {
        name: 'slow.sh',
        description: 'Sleeps longer than the timeout allows.',
      },
    ]);
  });

  it('returns an empty list when the directory does not exist', async () => {
    process.env.QUICKDUMP_SCRIPTS_DIR = `${fixtures}/does-not-exist`;

    expect(await service.list()).toEqual([]);
  });
});

describe('resolving a script to run', () => {
  it('resolves a listed script to its absolute path', async () => {
    expect(await service.resolve('hello.sh')).toBe(`${fixtures}/hello.sh`);
  });

  it('refuses a script that is not in the directory', async () => {
    await expect(service.resolve('unknown.sh')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses a path that tries to leave the directory', async () => {
    await expect(service.resolve('../../etc/passwd.sh')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.resolve('nested/ignored.sh')).rejects.toThrow(
      BadRequestException,
    );
  });
});
