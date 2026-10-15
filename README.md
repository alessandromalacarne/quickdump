# quickdump

Capture thoughts in seconds, retrieve them by tag later.

A "dump" is a short note with at least one `#tag`. Type it, hit Enter, done. Dumps are grouped by tag for later processing (e.g. assembling a post from the dumps tagged `#blog`).

## Stack

- **api/** — NestJS 12 + Prisma 7 + PostgreSQL, TypeScript ESM
- **web/** — React 19 + Vite 8 + Tailwind CSS 4, TypeScript

## Structure

```
api/                 REST API (dumps + tags + workflows)
  prisma/            schema and migrations
  src/dumps/         POST /dumps, GET /dumps?tag=
  src/tags/          GET /tags, DELETE /tags/:id
  src/workflows/     rules engine: triggers, actions, scheduler, run history
  test/              e2e tests (supertest + real Postgres)
web/                 SPA: composer, tag pages, workflows page, dark theme
scripts/pg.sh        Local Postgres via nix (init/start/stop/reset)
scripts/prisma.sh    Prisma CLI wrapper (schema-engine from nixpkgs)
scripts/workflows/   scripts a workflow may run (see its README)
compose.yaml         Postgres via Docker, alternative to pg.sh
flake.nix            devShell (Node 24 + Postgres + Prisma engines)
```

## Running

Prerequisites: Node 24+, and Postgres in one of two ways:

```bash
# Option 0 — nix devShell (Node, Postgres and Prisma engines ready to go)
nix develop

# Option A — local Postgres via nix (no Docker)
./scripts/pg.sh start        # creates the quickdump and quickdump_test databases

# Option B — Docker
docker compose up -d
```

Then:

```bash
cd api
cp .env.example .env
npm install
npm run prisma:generate
npm run db:migrate
npm run start:dev            # API at http://localhost:3000

cd ../web
npm install
npm run dev                  # app at http://localhost:5173
```

Vite proxies `/api` to `localhost:3000`.

## Tests

```bash
cd api && npm test           # unit (tag parser, triggers, cron, export format, scripts)
cd api && npm run test:e2e   # e2e with real Postgres (uses quickdump_test)
cd web && npm test           # components and flows (jsdom + Testing Library)
```

## API

| Method | Route                    | Description                                        |
| ------ | ------------------------ | -------------------------------------------------- |
| POST   | `/dumps`                 | Creates a dump. `{ "content": "... #tag" }` → 201 |
| GET    | `/dumps`                 | Lists dumps, newest first                          |
| GET    | `/dumps?tag=home`        | Filters by tag (case-insensitive)                  |
| GET    | `/tags`                  | Tags with counts, most used first                  |
| DELETE | `/tags/:id`              | Deletes a tag, keeps its dumps → 204               |
| GET    | `/workflows`             | Workflow rules with their tag scope                |
| POST   | `/workflows`             | Creates a rule → 201                               |
| PATCH  | `/workflows/:id`         | Edits a rule, enables/disables it                  |
| DELETE | `/workflows/:id`         | Deletes a rule and its run history → 204           |
| GET    | `/workflows/:id/runs`    | Run history, newest first (`?limit=`, max 100)     |
| POST   | `/workflows/:id/run`     | Runs it right now → 202 `{ "runId": "…" }`         |
| GET    | `/scripts`               | Scripts available to workflows, with descriptions  |

Validation errors return 400. Dump without a tag: `{"message": "Include at least one #tag in the dump"}`.

## Workflows

A workflow is a rule: **when** something happens, **do** something.

```jsonc
// when a dump lands on #casa, run scripts/workflows/notify.sh
{ "name": "notify casa", "event": "dumpCreated", "tags": ["casa"],
  "action": "script", "config": { "script": "notify.sh", "args": ["--quiet"] } }

// every day at 23:59, write the day's #casa dumps to a text file
{ "name": "daily casa export", "cron": "59 23 * * *", "timezone": "America/Sao_Paulo",
  "tags": ["casa"], "action": "export", "config": { "window": "day" } }
```

- **Triggers** — `event` (`dumpCreated`, `tagDeleted`) or `cron` + `timezone`, never both.
- **Tag scope** — `tags: []` means every tag. It filters the event *and* what an export covers.
- **Actions** — `script` (a file from `scripts/workflows/`, optional `args`, `cwd`, `timeoutMs`)
  or `export` (a plain text file of the window's dumps, `window` being `sinceLastRun`, `day` or `all`).
- Reports are kept per run: status, exit code, `stdout`, `stderr` and the file written.
- A failed workflow never fails the request that triggered it — the dump is saved either way.
- If the API was down when a schedule was due, it catches up once on the next start, over the
  whole missed window.
- Scheduled runs are polled every 30s (`QUICKDUMP_SCHEDULER=off` turns the poller off).

⚠️ A workflow runs a script with the API's own privileges, and the API has no authentication.
It binds to `127.0.0.1` by default for that reason — set `HOST=0.0.0.0` only if you trust
everything that can reach the port. See `scripts/workflows/README.md` for the script contract.

## Notes

- Tags are extracted from the content itself (`#home` → `home`), lowercased, no duplicates.
- Web UI: dark theme, composer (Enter sends, Shift+Enter breaks the line, clicking anywhere
  focuses the field), tag pages and a workflows page to create rules and read their runs.
- Single-user: no authentication in this version.
- On NixOS, Prisma needs the `schema-engine` from nixpkgs, so database commands go through `scripts/prisma.sh`.
- The `flake.nix` devShell exports `PRISMA_SCHEMA_ENGINE_BINARY`, so plain `npx prisma` also works inside `nix develop`.
