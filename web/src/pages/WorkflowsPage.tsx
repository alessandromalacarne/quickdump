import { useEffect, useState } from 'react';
import {
  createWorkflow,
  deleteWorkflow,
  listScripts,
  listWorkflows,
  updateWorkflow,
  type ScriptRef,
  type Workflow,
  type WorkflowInput,
} from '../api';
import { WorkflowCard } from '../components/WorkflowCard';
import { WorkflowForm } from '../components/WorkflowForm';

interface Store {
  workflows: Workflow[];
  scripts: ScriptRef[];
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function useStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([listWorkflows(), listScripts()])
      .then(([workflows, scripts]) => {
        if (active) {
          setStore({ workflows, scripts });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(messageOf(cause, 'Could not load the workflows'));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function update(change: (current: Store) => Store) {
    setStore((current) => (current === null ? current : change(current)));
  }

  return { store, error, setError, update };
}

function useActions(
  update: (change: (current: Store) => Store) => void,
  setError: (message: string | null) => void,
) {
  async function create(input: WorkflowInput) {
    const created = await createWorkflow(input);
    update((current) => ({
      ...current,
      workflows: [...current.workflows, created],
    }));
  }

  async function toggle(id: string, enabled: boolean) {
    try {
      const updated = await updateWorkflow(id, { enabled });
      update((current) => ({
        ...current,
        workflows: current.workflows.map((workflow) =>
          workflow.id === id ? updated : workflow,
        ),
      }));
      setError(null);
    } catch (cause) {
      setError(messageOf(cause, 'Could not update the workflow'));
    }
  }

  async function remove(id: string) {
    try {
      await deleteWorkflow(id);
      update((current) => ({
        ...current,
        workflows: current.workflows.filter((workflow) => workflow.id !== id),
      }));
      setError(null);
    } catch (cause) {
      setError(messageOf(cause, 'Could not delete the workflow'));
    }
  }

  return { create, toggle, remove };
}

export function WorkflowsPage() {
  const { store, error, setError, update } = useStore();
  const { create, toggle, remove } = useActions(update, setError);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-5 sm:p-8">
      <h1 className="text-sm font-medium tracking-widest text-ink-faint uppercase">
        workflows
      </h1>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <WorkflowForm scripts={store?.scripts ?? []} onSubmit={create} />

      {store === null ? (
        <p role="status" className="mt-6 text-sm text-ink-faint">
          loading workflows…
        </p>
      ) : store.workflows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">
          No workflows yet. Create one above to react to your tags.
        </p>
      ) : (
        <ul className="mt-6 grid list-none gap-3">
          {store.workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
