import { accessSync, constants } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '.env'));
} catch {
  // .env is optional; values already in the environment take precedence.
}

function findSchemaEngine(): string | undefined {
  const binary =
    process.platform === 'win32' ? 'schema-engine.exe' : 'schema-engine';
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, binary);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return undefined;
}

if (!process.env.PRISMA_SCHEMA_ENGINE_BINARY) {
  const engine = findSchemaEngine();
  if (engine) {
    process.env.PRISMA_SCHEMA_ENGINE_BINARY = engine;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
