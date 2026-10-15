import type { Dump } from '../api';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface DumpCardProps {
  dump: Dump;
}

export function DumpCard({ dump }: DumpCardProps) {
  return (
    <li className="rounded-2xl border border-line bg-surface-raised p-5">
      <p className="whitespace-pre-wrap leading-relaxed text-ink">
        {dump.content}
      </p>

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {dump.tags.map((tag) => (
          <span
            key={tag.id}
            className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft"
          >
            #{tag.name}
          </span>
        ))}
        <time
          dateTime={dump.createdAt}
          className="ml-auto text-xs text-ink-faint"
        >
          {dateFormat.format(new Date(dump.createdAt))}
        </time>
      </footer>
    </li>
  );
}
