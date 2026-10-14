import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/quickdump_test';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export default function setup(): void {
  execFileSync(
    join(apiRoot, '..', 'scripts', 'prisma.sh'),
    ['migrate', 'deploy'],
    {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'inherit',
    },
  );
}
