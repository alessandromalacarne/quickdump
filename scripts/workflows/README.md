# Workflow scripts

Every `*.sh` file in this directory is offered to workflows as an action ("run a script").
A workflow points at one of them by name — nothing outside this directory can be run, which
is what keeps `POST /workflows` from being a remote code execution endpoint.

Point `QUICKDUMP_SCRIPTS_DIR` at another directory to keep your scripts out of the repo.

## Example

```sh
#!/bin/sh
# Sends the dump to my notes inbox.        <- first comment line becomes the description
payload=$(cat)
printf '%s\n' "$payload" >> ~/notes/inbox.jsonl
```

Make it executable if you invoke it yourself; the API runs it through `sh`, so the bit is
not required.

## What a script receives

The dump (or the schedule window) arrives as JSON on **stdin**:

```json
{
  "workflow": { "id": "0199…", "name": "send casa to my inbox" },
  "trigger": {
    "kind": "dumpCreated",
    "occurredAt": "2026-10-15T17:32:00.000Z",
    "dump": { "id": "0199…", "content": "#casa buy coffee", "tagNames": ["casa"] }
  }
}
```

`trigger.kind` is one of:

- `dumpCreated` — `trigger.dump` carries the `id`, the raw `content` and the lowercased `tagNames`.
- `tagDeleted` — `trigger.tag` carries the `id` and the `name`.
- `schedule` — `trigger.window` carries `from` and `to` (ISO timestamps).
- `manual` — someone pressed "run now".

The same facts are in the environment:

| Variable                | When                                       |
| ----------------------- | ------------------------------------------ |
| `QUICKDUMP_EVENT`       | always (`dumpCreated`, `tagDeleted`, …)    |
| `QUICKDUMP_WORKFLOW_ID` | always                                     |
| `QUICKDUMP_WORKFLOW_NAME` | always                                   |
| `QUICKDUMP_DUMP_ID`     | `dumpCreated`                              |
| `QUICKDUMP_TAGS`        | `dumpCreated` (comma separated), `tagDeleted` |
| `QUICKDUMP_WINDOW_FROM` | `schedule`                                 |
| `QUICKDUMP_WINDOW_TO`   | `schedule`                                 |

Extra arguments configured on the workflow arrive as `$1`, `$2`, … — they are passed as
argv, never through a shell, so nothing in them is interpreted.

## How it is run

- Timeout: 30s by default (`timeoutMs` on the workflow config, up to 5 minutes). On timeout
  the whole process group is killed.
- Exit code 0 is a success; anything else marks the run as failed and stores the code,
  `stdout` and `stderr` (each capped at 64 KiB) in the run history.
- The working directory is the repository root unless the workflow sets `cwd`.
- Runs are serial: a slow script delays the next one instead of racing it for the same file.
