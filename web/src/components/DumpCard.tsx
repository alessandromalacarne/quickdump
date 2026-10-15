import { useState } from 'react';
import type { Dump } from '../api';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M4 20h4L18.5 9.5a2.828 2.828 0 0 0-4-4L4 16v4Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

const iconButtonClass =
  'flex h-10 w-10 items-center justify-center rounded-full text-ink-faint transition-[color,opacity,background-color] hover:bg-paper focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 disabled:cursor-not-allowed disabled:opacity-50';

interface DumpCardProps {
  dump: Dump;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DumpCard({ dump, onUpdate, onDelete }: DumpCardProps) {
  const [draft, setDraft] = useState(dump.content);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(dump.content);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await onUpdate(dump.id, draft.trim());
      setEditing(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update the dump',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await onDelete(dump.id);
    } catch (cause) {
      setConfirming(false);
      setError(
        cause instanceof Error ? cause.message : 'Could not delete the dump',
      );
      setBusy(false);
    }
  }

  return (
    <li className="group rounded-2xl border border-line bg-surface-raised p-5">
      {editing ? (
        <>
          <textarea
            autoFocus
            rows={3}
            disabled={busy}
            aria-label="Edit dump"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                cancelEditing();
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void save();
              }
            }}
            className="w-full resize-y rounded-xl border border-line bg-paper p-3 leading-relaxed text-ink focus:border-mark focus:outline-none disabled:opacity-60"
          />

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex min-h-9 items-center rounded-full bg-mark px-4 text-sm font-semibold text-mark-contrast transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEditing}
              className="inline-flex min-h-9 items-center rounded-full px-4 text-sm text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap leading-relaxed text-ink">
          {dump.content}
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {dump.tags.map((tag) => (
          <span
            key={tag.id}
            className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft"
          >
            #{tag.name}
          </span>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <time dateTime={dump.createdAt} className="text-xs text-ink-faint">
            {dateFormat.format(new Date(dump.createdAt))}
          </time>

          {editing ? null : (
            <>
              <button
                type="button"
                onClick={startEditing}
                aria-label="Edit dump"
                className={`${iconButtonClass} hover:text-ink`}
              >
                <PencilIcon />
              </button>

              {confirming ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Confirm delete"
                  onBlur={() => setConfirming(false)}
                  onClick={() => void remove()}
                  className="inline-flex min-h-10 items-center rounded-full bg-paper px-3 text-xs font-medium text-danger transition-[filter] hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  confirm?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  aria-label="Delete dump"
                  className={`${iconButtonClass} hover:text-danger`}
                >
                  <TrashIcon />
                </button>
              )}
            </>
          )}
        </div>
      </footer>
    </li>
  );
}
