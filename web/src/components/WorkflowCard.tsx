import { useEffect, useState } from 'react';
import {
  listWorkflowRuns,
  runWorkflowNow,
  type RunStatus,
  type Workflow,
  type WorkflowRun,
} from '../api';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const statusClass: Record<RunStatus, string> = {
  pending: 'text-ink-faint',
  running: 'text-ink-faint',
  success: 'text-mark',
  failed: 'text-danger',
  interrupted: 'text-ink-faint',
};

const EVENT_LABEL: Record<string, string> = {
  dumpCreated: 'when a dump is created',
  tagDeleted: 'when a tag is deleted',
};

const SETTLED: RunStatus[] = ['success', 'failed', 'interrupted'];

function triggerSummary(workflow: Workflow): string {
  const scope =
    workflow.tags.length > 0
      ? ` · ${workflow.tags.map((tag) => `#${tag.name}`).join(' ')}`
      : '';

  if (workflow.cron !== null) {
    return `every ${workflow.cron} (${workflow.timezone})${scope}`;
  }

  return `${EVENT_LABEL[workflow.event ?? ''] ?? 'never'}${scope}`;
}

function actionSummary(workflow: Workflow): string {
  return workflow.action === 'script'
    ? `runs ${String(workflow.config.script ?? '')}`
    : 'writes an export file';
}

function useRuns(workflowId: string) {
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<WorkflowRun[]> {
    const loaded = await listWorkflowRuns(workflowId);
    setRuns(loaded);
    return loaded;
  }

  useEffect(() => {
    let active = true;

    listWorkflowRuns(workflowId)
      .then((loaded) => {
        if (active) {
          setRuns(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Could not load the runs',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [workflowId]);

  async function runNow() {
    setError(null);

    try {
      await runWorkflowNow(workflowId);

      // The run happens off the request, so poll until it settles.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const loaded = await reload();
        if (loaded.every((run) => SETTLED.includes(run.status))) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not run the workflow',
      );
    }
  }

  return { runs, error, runNow };
}

function RunItem({ run }: { run: WorkflowRun }) {
  return (
    <li className="rounded-xl bg-paper p-3 text-xs">
      <p className="flex flex-wrap items-center gap-2">
        <span className={`font-medium ${statusClass[run.status]}`}>
          {run.status}
        </span>
        <time dateTime={run.startedAt} className="text-ink-faint">
          {dateFormat.format(new Date(run.startedAt))}
        </time>
        {run.outputFile === null ? null : (
          <span className="truncate text-ink-faint">{run.outputFile}</span>
        )}
      </p>

      {run.error ? <p className="mt-1 text-danger">{run.error}</p> : null}
      {run.stdout ? (
        <pre className="mt-1 overflow-x-auto text-ink-soft">{run.stdout}</pre>
      ) : null}
    </li>
  );
}

function RunList({
  runs,
  workflowName,
}: {
  runs: WorkflowRun[] | null;
  workflowName: string;
}) {
  if (runs === null) {
    return (
      <p role="status" className="mt-3 text-xs text-ink-faint">
        loading runs…
      </p>
    );
  }

  if (runs.length === 0) {
    return <p className="mt-3 text-xs text-ink-faint">no runs yet</p>;
  }

  return (
    <ul aria-label={`runs of ${workflowName}`} className="mt-3 grid gap-2">
      {runs.map((run) => (
        <RunItem key={run.id} run={run} />
      ))}
    </ul>
  );
}

interface WorkflowCardProps {
  workflow: Workflow;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

function CardHeader({
  workflow,
  onToggle,
}: Pick<WorkflowCardProps, 'workflow' | 'onToggle'>) {
  return (
    <header className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{workflow.name}</p>
        <p className="text-xs text-ink-faint">
          {triggerSummary(workflow)} · {actionSummary(workflow)}
        </p>
        {workflow.nextRunAt === null ? null : (
          <p className="text-xs text-ink-faint">
            next run {dateFormat.format(new Date(workflow.nextRunAt))}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          aria-label={`enabled ${workflow.name}`}
          checked={workflow.enabled}
          onChange={(changed) => onToggle(workflow.id, changed.target.checked)}
        />
        enabled
      </label>
    </header>
  );
}

function CardButtons({
  workflow,
  runNow,
  onDelete,
}: {
  workflow: Workflow;
  runNow: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={runNow}
        aria-label={`Run workflow ${workflow.name} now`}
        className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-paper hover:text-ink"
      >
        run now
      </button>
      <button
        type="button"
        onClick={() => onDelete(workflow.id)}
        aria-label={`Delete workflow ${workflow.name}`}
        className="rounded-full border border-line px-3 py-1 text-xs text-ink-faint transition-colors hover:bg-paper hover:text-danger"
      >
        delete
      </button>
    </div>
  );
}

export function WorkflowCard({
  workflow,
  onToggle,
  onDelete,
}: WorkflowCardProps) {
  const { runs, error, runNow } = useRuns(workflow.id);

  return (
    <li
      aria-label={`workflow ${workflow.name}`}
      className="rounded-2xl border border-line bg-surface-raised p-5"
    >
      <CardHeader workflow={workflow} onToggle={onToggle} />
      <CardButtons workflow={workflow} runNow={runNow} onDelete={onDelete} />

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <RunList runs={runs} workflowName={workflow.name} />
    </li>
  );
}
