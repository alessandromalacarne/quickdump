# quickdump

Capture thoughts in seconds, retrieve them by tag later.

A "dump" is a short note with at least one `#tag`. Type it, hit Enter, done. Dumps are grouped by tag for later processing (e.g. assembling a post from the dumps tagged `#blog`).

## Stack

- **api/** — NestJS 12 + Prisma 7 + PostgreSQL, TypeScript ESM
- **web/** — React 19 + Vite 8 + Tailwind CSS 4, TypeScript

## Structure

```
api/                 REST API (dumps + tags)
  prisma/            schema and migrations
  src/dumps/         POST /dumps, GET /dumps?tag=, PATCH /dumps/:id, DELETE /dumps/:id
  src/tags/          GET /tags
  test/              e2e tests (supertest + real Postgres)
web/                 SPA: single full-screen composer, dark theme
scripts/pg.sh        Local Postgres via nix (init/start/stop/reset)
scripts/prisma.sh    Prisma CLI wrapper (schema-engine from nixpkgs)
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
cd api && npm test           # unit (tag parser)
cd api && npm run test:e2e   # e2e with real Postgres (uses quickdump_test)
cd web && npm test           # components and flows (jsdom + Testing Library)
```

## API

| Method | Route            | Description                               |
| ------ | ---------------- | ----------------------------------------- |
| POST   | `/dumps`         | Creates a dump. `{ "content": "... #tag" }` → 201 |
| GET    | `/dumps`         | Lists dumps, newest first                 |
| GET    | `/dumps?tag=home`| Filters by tag (case-insensitive)         |
| PATCH  | `/dumps/:id`     | Replaces the content. `{ "content": "... #tag" }` → 200 |
| DELETE | `/dumps/:id`     | Deletes a dump → 204                      |
| GET    | `/tags`          | Tags with counts, most used first         |

Validation errors return 400. Dump without a tag: `{"message": "Include at least one #tag in the dump"}`. Unknown dump on PATCH/DELETE: 404 `{"message": "Dump not found"}`.

## Notes

- Tags are extracted from the content itself (`#home` → `home`), lowercased, no duplicates. A tag whose last dump is edited away or deleted is removed from `/tags`.
- Web UI: dark theme, single screen with the composer (Enter sends, Shift+Enter breaks the line, clicking anywhere focuses the field).
- `/tag/:tag` lists the dumps of a tag with a composer pre-filled with the tag, inline editing and delete behind a `confirm?` step.
- Single-user: no authentication in this version.
- On NixOS, Prisma needs the `schema-engine` from nixpkgs, so database commands go through `scripts/prisma.sh`.
- The `flake.nix` devShell exports `PRISMA_SCHEMA_ENGINE_BINARY`, so plain `npx prisma` also works inside `nix develop`.
