import { useState, type FormEvent } from 'react';
import type {
  ScriptRef,
  WorkflowAction,
  WorkflowEvent,
  WorkflowInput,
} from '../api';

const EVENTS: { value: WorkflowEvent; label: string }[] = [
  { value: 'dumpCreated', label: 'a dump is created' },
  { value: 'tagDeleted', label: 'a tag is deleted' },
];

const WINDOWS = [
  { value: 'sinceLastRun', label: 'everything since the last run' },
  { value: 'day', label: 'the current day' },
  { value: 'all', label: 'everything' },
];

const fieldClass =
  'rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink';

interface Draft {
  name: string;
  trigger: 'event' | 'schedule';
  event: WorkflowEvent;
  cron: string;
  timezone: string;
  tags: string;
  action: WorkflowAction;
  script: string;
  window: string;
}

function emptyDraft(): Draft {
  return {
    name: '',
    trigger: 'event',
    event: 'dumpCreated',
    cron: '59 23 * * *',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tags: '',
    action: 'script',
    script: '',
    window: 'sinceLastRun',
  };
}

function complaintAbout(draft: Draft): string | null {
  if (draft.name.trim() === '') {
    return 'Give the workflow a name';
  }

  if (draft.action === 'script' && draft.script === '') {
    return 'Choose a script';
  }

  return null;
}

function toInput(draft: Draft): WorkflowInput {
  const scope = draft.tags
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean);

  return {
    name: draft.name.trim(),
    ...(draft.trigger === 'event'
      ? { event: draft.event }
      : { cron: draft.cron.trim(), timezone: draft.timezone.trim() }),
    action: draft.action,
    config:
      draft.action === 'script'
        ? { script: draft.script }
        : { window: draft.window },
    tags: scope,
  };
}

function useDraft(onSubmit: (input: WorkflowInput) => Promise<void>) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(domEvent: FormEvent<HTMLFormElement>) {
    domEvent.preventDefault();

    const complaint = complaintAbout(draft);
    if (complaint !== null) {
      setError(complaint);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit(toInput(draft));
      setDraft((current) => ({ ...current, name: '', tags: '' }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save the workflow',
      );
    } finally {
      setSaving(false);
    }
  }

  return { draft, update, error, saving, submit };
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: FieldProps) {
  const handle = (changed: { target: { value: string } }) =>
    onChange(changed.target.value);

  return (
    <p className="grid gap-1">
      <label htmlFor={id} className="text-xs text-ink-soft">
        {label}
      </label>

      {options ? (
        <select id={id} value={value} onChange={handle} className={fieldClass}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          value={value}
          onChange={handle}
          placeholder={placeholder}
          className={fieldClass}
        />
      )}
    </p>
  );
}

interface TriggerFieldsProps {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}

function TriggerFields({ draft, update }: TriggerFieldsProps) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs text-ink-soft">trigger</legend>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="radio"
          name="trigger"
          checked={draft.trigger === 'event'}
          onChange={() => update('trigger', 'event')}
        />
        when a dump or tag event happens
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="radio"
          name="trigger"
          checked={draft.trigger === 'schedule'}
          onChange={() => update('trigger', 'schedule')}
        />
        on a schedule
      </label>

      {draft.trigger === 'event' ? (
        <Field
          id="workflow-event"
          label="event"
          value={draft.event}
          onChange={(value) => update('event', value as WorkflowEvent)}
          options={EVENTS}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field
            id="workflow-cron"
            label="cron"
            value={draft.cron}
            onChange={(value) => update('cron', value)}
          />
          <Field
            id="workflow-timezone"
            label="timezone"
            value={draft.timezone}
            onChange={(value) => update('timezone', value)}
          />
        </div>
      )}
    </fieldset>
  );
}

interface ActionFieldsProps extends TriggerFieldsProps {
  scripts: ScriptRef[];
}

function ActionFields({ draft, update, scripts }: ActionFieldsProps) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs text-ink-soft">action</legend>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="radio"
          name="action"
          checked={draft.action === 'script'}
          onChange={() => update('action', 'script')}
        />
        run a script
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="radio"
          name="action"
          checked={draft.action === 'export'}
          onChange={() => update('action', 'export')}
        />
        write an export file
      </label>

      {draft.action === 'script' ? (
        <ScriptField
          scripts={scripts}
          value={draft.script}
          onChange={(value) => update('script', value)}
        />
      ) : (
        <Field
          id="workflow-window"
          label="window"
          value={draft.window}
          onChange={(value) => update('window', value)}
          options={WINDOWS}
        />
      )}
    </fieldset>
  );
}

function ScriptField(props: {
  scripts: ScriptRef[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (props.scripts.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        No scripts found. Add a .sh file to the scripts directory.
      </p>
    );
  }

  return (
    <Field
      id="workflow-script"
      label="script"
      value={props.value}
      onChange={props.onChange}
      options={[
        { value: '', label: 'choose a script…' },
        ...props.scripts.map((script) => ({
          value: script.name,
          label: script.description
            ? `${script.name} — ${script.description}`
            : script.name,
        })),
      ]}
    />
  );
}

interface WorkflowFormProps {
  scripts: ScriptRef[];
  onSubmit: (input: WorkflowInput) => Promise<void>;
}

export function WorkflowForm({ scripts, onSubmit }: WorkflowFormProps) {
  const { draft, update, error, saving, submit } = useDraft(onSubmit);

  return (
    <form
      aria-label="new workflow"
      onSubmit={submit}
      className="mt-6 grid gap-4 rounded-2xl border border-line bg-surface-raised p-5"
    >
      <h2 className="text-sm font-medium tracking-widest text-ink-faint uppercase">
        new workflow
      </h2>

      <Field
        id="workflow-name"
        label="name"
        value={draft.name}
        onChange={(value) => update('name', value)}
      />

      <TriggerFields draft={draft} update={update} />

      <Field
        id="workflow-tags"
        label="tags"
        value={draft.tags}
        onChange={(value) => update('tags', value)}
        placeholder="casa, financas — empty means every tag"
      />

      <ActionFields draft={draft} update={update} scripts={scripts} />

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="justify-self-start rounded-full bg-mark px-4 py-2 text-sm font-medium text-mark-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        create workflow
      </button>
    </form>
  );
}
