import { useEffect, useRef, useState } from 'react';
import { extractTags } from '../lib/extract-tags';

interface ComposerProps {
  onSubmit: (content: string) => Promise<void>;
}

export function Composer({ onSubmit }: ComposerProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  async function submit() {
    const content = value.trim();
    if (content.length === 0) {
      setError('Write something before dumping');
      return;
    }
    if (extractTags(content).length === 0) {
      setError('Include at least one #tag in the dump');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await onSubmit(content);
      setValue('');
      setSaved(true);
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1600);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not send the dump',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label="New dump"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onClick={(event) => {
        if (
          (event.target as HTMLElement).closest('button, textarea') === null
        ) {
          textareaRef.current?.focus();
        }
      }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]"
    >
      <textarea
        ref={textareaRef}
        autoFocus
        aria-label="New dump"
        placeholder="Write what's on your mind... and tag it with #tag"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) {
            setError(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
        disabled={busy}
        className="min-h-0 w-full flex-1 resize-none bg-transparent p-5 text-lg leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60 sm:p-8 sm:text-xl"
      />

      <div className="flex min-h-16 items-center gap-4 border-t border-line px-4 py-3 sm:px-6">
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : saved ? (
          <p className="animate-fade-in text-sm text-ink-soft">dump saved</p>
        ) : (
          <p className="text-sm text-ink-faint">
            Enter sends · at least one #tag
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-full bg-mark px-6 font-semibold text-mark-contrast transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dump
        </button>
      </div>
    </form>
  );
}
